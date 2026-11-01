import { defineTestHooks } from '@pragma/sdk/main'
import type { PtyInfo } from '../contract'
import { getMainRuntime } from './runtime'

/** `globalThis.__pragmaTerminalTest`, installed only when `PRAGMA_TEST=1` (§8). */
export interface TerminalTestHooks {
  daemonPid(): number | undefined
  listPtys(): PtyInfo[]
  readText(ptyId: string): Promise<string>
  /** SIGKILLs the daemon (crash simulation). */
  killDaemon(): void
  shellEnv(): Promise<Record<string, string>>
  /** Runs a command in a pty (no shell rc files) and resolves with its output once it exits. */
  spawnCapture(command: string, args: string[], cwd: string): Promise<string>
  /** Links `terminal.openLink` was asked to open; recorded instead of opening a browser. */
  openedLinks: string[]
}

export type TerminalTestGlobal = { __pragmaTerminalTest: TerminalTestHooks }

const CAPTURE_SIZE = { cols: 200, rows: 50 }

export default defineTestHooks(() => {
  const runtime = getMainRuntime()
  const openedLinks: string[] = []
  runtime.openExternal = async (url) => {
    openedLinks.push(url)
  }
  const hooks: TerminalTestHooks = {
    daemonPid: () => getMainRuntime().host.pid,
    listPtys: () => getMainRuntime().pty.list(),
    readText: (ptyId) => getMainRuntime().pty.readText(ptyId),
    killDaemon: () => {
      const pid = getMainRuntime().host.pid
      if (pid !== undefined) process.kill(pid, 'SIGKILL')
    },
    shellEnv: () => getMainRuntime().pty.getShellEnv(),
    async spawnCapture(command, args, cwd) {
      const { pty } = getMainRuntime()
      const chunks: { ptyId: string; data: string }[] = []
      const off = pty.onAnyData((e) => chunks.push(e)) // subscribed before spawn: no early output is lost
      try {
        const ptyId = await pty.spawn({ cwd, command, args, ...CAPTURE_SIZE })
        await new Promise<void>((resolve) => pty.onExit(ptyId, () => resolve()))
        await pty.kill(ptyId)
        return chunks
          .filter((c) => c.ptyId === ptyId)
          .map((c) => c.data)
          .join('')
      } finally {
        off()
      }
    },
    openedLinks,
  }
  ;(globalThis as unknown as TerminalTestGlobal).__pragmaTerminalTest = hooks
})
