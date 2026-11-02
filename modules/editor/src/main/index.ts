import { arch } from 'node:process'
import { BRIDGE_ENV } from '@pragma/module-bridge/contract'
import { TEST_MODE_ENABLED, TEST_MODE_ENV } from '@pragma/sdk'
import { defineMainModule, type MainContext, readJsonFile } from '@pragma/sdk/main'
import { net, session, WebContentsView } from 'electron'
import { EDITOR_PARTITION, SERVER_EVENT as EV, EXIT_EVENT, SERVER_STOP_ON_QUIT_MS, TEST_ENV } from '../constants'
import {
  EDITOR_MODULE_ID,
  EDITOR_OPEN_DIFF,
  EDITOR_OPEN_FILE,
  EDITOR_STATE,
  EditorIpcEvents,
  EditorServiceToken,
  type EditorSettings,
  EditorSettingsSchema,
  editorSettingsDefaults,
  OpenDiffArgsSchema,
  OpenFileArgsSchema,
} from '../contract'
import { EditorBridge } from './bridge/editorBridge'
import { EditorServiceImpl } from './editorService'
import { EditorInstaller } from './install/installer'
import { registerEditorIpc } from './ipc'
import { type EditorRelease, EditorReleaseSchema, PINNED_RELEASE } from './release/release'
import { type EditorRuntime, setEditorRuntime } from './runtime'
import { locateBridgeVsix } from './server/bridgeVsix'
import { createServerController } from './server/serverController'
import { ThemeState } from './theme/themeState'
import { createUpstream } from './upstream'
import { configureEditorSession, hardenEditorWebContents } from './views/editorSession'
import { ViewManager } from './views/viewManager'
import { workbenchUrl } from './views/workbenchUrl'

/** Test-only overrides (`TEST_ENV`), read only in test mode. */
function testOverrides(ctx: MainContext): { release?: EditorRelease; downloadCacheDir?: string; installRoot?: string } {
  if (!ctx.testMode) return {}
  const env = process.env
  const file = env[TEST_ENV.releaseOverride]
  const parsed = file ? readJsonFile(file, EditorReleaseSchema) : undefined
  return {
    release: parsed?.ok ? parsed.value : undefined,
    downloadCacheDir: env[TEST_ENV.downloadCache],
    installRoot: env[TEST_ENV.serverRoot],
  }
}

function createCore(ctx: MainContext, typed: MainContext<EditorSettings>) {
  const over = testOverrides(ctx)
  const release = over.release ?? PINNED_RELEASE
  const installer = new EditorInstaller({
    userDataDir: ctx.paths.userData,
    release,
    platform: process.platform,
    arch,
    fetchImpl: net.fetch as typeof fetch,
    downloadCacheDir: over.downloadCacheDir,
    installRootOverride: over.installRoot,
  })
  const up = createUpstream(ctx)
  const server = createServerController({
    userDataDir: ctx.paths.userData,
    release,
    installer,
    platform: process.platform,
    graceSeconds: () => typed.settings.get().reconnectionGraceSeconds,
    env: async () => ({
      ...process.env,
      ...(await ctx.env.getShellEnv()),
      [BRIDGE_ENV.url]: up.bridge.url,
      [BRIDGE_ENV.token]: up.bridge.token,
      ...(ctx.testMode ? { [TEST_MODE_ENV]: TEST_MODE_ENABLED } : {}),
    }),
    bridgeVsix: () =>
      locateBridgeVsix({
        env: process.env,
        testMode: ctx.testMode,
        resource: (rel) => ctx.paths.resource(EDITOR_MODULE_ID, rel),
      }),
    log: { info: (m) => ctx.log.info(m), warn: (m, e) => ctx.log.warn(m, e) },
  })
  return { installer, up, server }
}

function activateEditor(typed: MainContext<EditorSettings>): void {
  const ctx = typed as MainContext
  const settings = () => typed.settings.get()
  const { installer, up, server } = createCore(ctx, typed)
  const openExternal = (url: string): void =>
    void ctx.shell.openExternal(url).catch((e: unknown) => ctx.log.warn(`could not open ${url}`, e))
  const port = (): number | undefined => server.connection()?.port
  configureEditorSession(session.fromPartition(EDITOR_PARTITION), {
    getPort: port,
    serverRoot: () => installer.installDir,
    serveWebviewsLocally: () => settings().serveWebviewsLocally,
    openExternal,
  })
  const views = new ViewManager({
    nativeViews: ctx.nativeViews,
    createView: () =>
      new WebContentsView({
        webPreferences: { partition: EDITOR_PARTITION, contextIsolation: true, sandbox: true, nodeIntegration: false },
      }),
    url: (folderPath) => {
      const c = server.connection()
      return c ? workbenchUrl({ port: c.port, token: c.token, folderPath }) : undefined
    },
    maxViews: () => settings().maxOpenViews,
    onViewCreated: (_id, view) =>
      hardenEditorWebContents((view as WebContentsView).webContents, { port, openExternal }),
    log: (m) => ctx.log.warn(m),
  })
  const theme = new ThemeState({
    theme: ctx.theme,
    getSettings: settings,
    onSettingsChange: (cb) => {
      const d = typed.settings.onChange(cb)
      return () => d.dispose()
    },
  })
  const languageStatus: EditorRuntime['languageStatus'] = new Map()
  const bridge = new EditorBridge(up, {
    theme: () => theme.message(),
    folderToWorktree: (key) => views.folderKeyToWorktree(key),
    onLanguageStatus: (worktreeId, status) => {
      if (status) languageStatus.set(worktreeId, status)
      else languageStatus.delete(worktreeId)
      ctx.ipc.publish(EditorIpcEvents.languageStatusChanged, { worktreeId, status })
    },
  })
  let activated = false
  const showActive = async (): Promise<void> => {
    const id = up.getActiveWorktreeId()
    const wt = id ? await up.getWorktree(id) : null
    if (wt) views.show(wt)
    else views.hideAll()
  }
  const service = new EditorServiceImpl({
    server,
    views,
    bridge,
    up,
    settings,
    publishReveal: (worktreeId) => ctx.ipc.publish(EditorIpcEvents.revealRequested, { worktreeId }),
    markActivated: () => {
      activated = true
    },
    log: (m, e) => ctx.log.warn(m, e),
  })
  const rt: EditorRuntime = {
    service,
    views,
    server,
    installer,
    bridge,
    up,
    languageStatus,
    async start() {
      const s = await server.ensureRunning()
      if (s.state === EDITOR_STATE.ready && activated) await showActive()
    },
    markActivated: () => {
      activated = true
    },
  }
  setEditorRuntime(rt)
  const disposers: (() => void)[] = [
    bridge.register(),
    theme.onChange(() => bridge.pushTheme()),
    server.onStatus((s) => ctx.ipc.publish(EditorIpcEvents.statusChanged, s)),
    server.onServerEvent((e) => {
      if (e.type === EV.restarting) bridge.resetReady()
      if (e.type === EV.ready) views.reloadAll()
    }),
    up.onWorktreeSelected(() => {
      if (activated && server.status().state === EDITOR_STATE.ready) void showActive()
    }),
    up.onWorktreeRemoved((id) => views.destroy(id)),
  ]
  const settingsSub = typed.settings.onChange((s) => views.setMax(s.maxOpenViews))
  disposers.push(() => settingsSub.dispose())
  const onExit = (): void => server.killNow()
  process.on(EXIT_EVENT, onExit)
  disposers.push(() => process.off(EXIT_EVENT, onExit))
  registerEditorIpc(ctx, rt)
  ctx.commands.register(EDITOR_OPEN_FILE, (args) => service.openFile(OpenFileArgsSchema.parse(args)))
  ctx.commands.register(EDITOR_OPEN_DIFF, (args) => service.openDiff(OpenDiffArgsSchema.parse(args)))
  ctx.services.provide(EditorServiceToken, service)
  stopHooks = async () => {
    for (const d of disposers.splice(0)) d()
    views.hideAll()
    views.destroyAll()
    await server.stop(SERVER_STOP_ON_QUIT_MS).catch((e: unknown) => ctx.log.warn('editor server stop failed', e))
  }
}

let stopHooks: (() => Promise<void>) | undefined

export default defineMainModule<EditorSettings>({
  settings: { schema: EditorSettingsSchema, defaults: editorSettingsDefaults },
  activate: activateEditor,
  async deactivate() {
    await stopHooks?.()
    stopHooks = undefined
    setEditorRuntime(null)
  },
})
