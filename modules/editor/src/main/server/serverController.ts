import { join } from 'node:path'
import {
  BRIDGE_MARKER_FILE,
  EDITOR_DIR,
  SERVER_EVENT as EV,
  EXTENSION_INSTALL_TIMEOUT_MS,
  SERVER_SUBDIRS,
  STATE_FILE,
  TOKEN_FILE,
} from '../../constants'
import { EDITOR_ERROR, EDITOR_STATE, type EditorStatus, editorErrorI18nKey } from '../../contract'
import type { EditorInstaller } from '../install/installer'
import type { EditorRelease } from '../release/release'
import { type ServerDirs, serverCommand, startArgs } from './args'
import { type BridgeVsix, ensureBridgeExtension } from './bridgeVsix'
import { runOnce, type ServerEvent, ServerProcess } from './serverProcess'
import { choosePort, writeConnectionToken } from './serverState'

export interface ServerInfo {
  version: string
  port?: number
  installDir: string
  pid?: number
}

/** `ensureRunning` = install → stable port → token → bridge extension → `codium-server` (§ Task 13). */
export interface ServerController {
  ensureRunning(): Promise<EditorStatus>
  restart(): Promise<void>
  stop(timeoutMs?: number): Promise<void>
  status(): EditorStatus
  info(): ServerInfo
  /** Port + token while ready. */
  connection(): { port: number; token: string } | undefined
  onStatus(cb: (s: EditorStatus) => void): () => void
  onServerEvent(cb: (e: ServerEvent) => void): () => void
  /** Synchronous last-resort kill (process exit). */
  killNow(): void
}

export interface ServerControllerDeps {
  userDataDir: string
  release: EditorRelease
  installer: EditorInstaller
  platform: NodeJS.Platform
  graceSeconds: () => number
  env: () => Promise<NodeJS.ProcessEnv>
  bridgeVsix: () => BridgeVsix | null
  log: { info(m: string): void; warn(m: string, e?: unknown): void }
  /** Test overrides of the supervision timings. */
  processOptions?: { readyTimeoutMs?: number }
}

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export function createServerController(d: ServerControllerDeps): ServerController {
  const editorDir = join(d.userDataDir, EDITOR_DIR)
  const dirs: ServerDirs = {
    serverDataDir: join(editorDir, SERVER_SUBDIRS.server),
    userDataDir: join(editorDir, SERVER_SUBDIRS.data),
    extensionsDir: join(editorDir, SERVER_SUBDIRS.extensions),
  }
  const statusListeners = new Set<(s: EditorStatus) => void>()
  const eventListeners = new Set<(e: ServerEvent) => void>()
  const version = d.release.version
  let status: EditorStatus = d.installer.status()
  let proc: ServerProcess | undefined
  let conn: { port: number; token: string } | undefined
  let running: Promise<EditorStatus> | undefined

  const set = (s: EditorStatus): EditorStatus => {
    status = s
    for (const cb of [...statusListeners]) cb(s)
    return s
  }
  d.installer.onStatus((s) => {
    if (!proc) set(s)
  })
  const fail = (key: keyof typeof EDITOR_ERROR, detail: string): EditorStatus =>
    set({
      state: EDITOR_STATE.error,
      version,
      errorKey: editorErrorI18nKey(EDITOR_ERROR[key]),
      detail,
      retryable: true,
    })

  const onEvent = (e: ServerEvent): void => {
    if (e.type === EV.ready && conn) set({ state: EDITOR_STATE.ready, version, port: conn.port })
    if (e.type === EV.restarting) set({ state: EDITOR_STATE.starting, version })
    if (e.type === EV.failed)
      set({ state: EDITOR_STATE.error, version, errorKey: e.errorKey, detail: e.detail, retryable: true })
    for (const cb of [...eventListeners]) cb(e)
  }

  async function launch(): Promise<EditorStatus> {
    const previous = proc
    proc = undefined
    await previous?.stop()
    const installed = await d.installer.ensureInstalled()
    if (installed.state !== EDITOR_STATE.starting) return set(installed)
    set({ state: EDITOR_STATE.starting, version })
    const { port, portChanged } = await choosePort(join(editorDir, STATE_FILE))
    if (portChanged) d.log.warn(`editor port changed to ${port}; workbench settings of the old port are not visible`)
    const tokenFile = join(editorDir, TOKEN_FILE)
    const token = await writeConnectionToken(tokenFile)
    const env = await d.env()
    const cmd = serverCommand(d.installer.installDir, d.release, d.platform)
    const vsix = d.bridgeVsix()
    if (vsix) {
      try {
        const run = (args: string[]) => runOnce(cmd, args, env, EXTENSION_INSTALL_TIMEOUT_MS)
        const r = await ensureBridgeExtension({ vsix, markerFile: join(editorDir, BRIDGE_MARKER_FILE), run, dirs })
        d.log.info(`pragma-bridge ${vsix.version}: ${r}`)
      } catch (error) {
        return fail('extensionInstallFailed', errorText(error))
      }
    } else d.log.warn('pragma-bridge.vsix not found; editor comments are unavailable')
    conn = { port, token }
    const p = new ServerProcess({
      ...cmd,
      args: startArgs({ port, tokenFile, dirs, graceSeconds: d.graceSeconds() }),
      env,
      port,
      log: (l) => d.log.info(l),
      ...d.processOptions,
    })
    proc = p
    p.on(onEvent)
    try {
      await p.start()
    } catch {
      return status
    }
    return status
  }

  const api: ServerController = {
    ensureRunning() {
      if (status.state === EDITOR_STATE.ready) return Promise.resolve(status)
      running ??= launch()
        .catch((error: unknown) => fail('serverStartFailed', errorText(error)))
        .finally(() => {
          running = undefined
        })
      return running
    },
    async restart() {
      await api.stop()
      await api.ensureRunning()
    },
    async stop(timeoutMs) {
      const p = proc
      proc = undefined
      conn = undefined
      if (p) await p.stop(timeoutMs)
      set(d.installer.status())
    },
    status: () => status,
    info: () => ({ version, installDir: d.installer.installDir, port: conn?.port, pid: proc?.pid }),
    connection: () => (status.state === EDITOR_STATE.ready ? conn : undefined),
    onStatus(cb) {
      statusListeners.add(cb)
      return () => void statusListeners.delete(cb)
    },
    onServerEvent(cb) {
      eventListeners.add(cb)
      return () => void eventListeners.delete(cb)
    },
    killNow: () => proc?.killNow(),
  }
  return api
}
