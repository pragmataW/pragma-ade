import { PTY_EXIT_REASON, type PtyExit, type TerminalTab } from '../../contract'

export type ExitLike = Omit<PtyExit, 'ptyId'>
/** A translate function (`useT()` or an i18next `t`). */
export type Translate = (key: string, opts?: Record<string, unknown>) => string
type T = Translate

/** "Exited (code N)", "Exited (signal N)" or the daemon-restart text. */
export function exitText(exit: ExitLike, t: T): string {
  if (exit.reason === PTY_EXIT_REASON.daemonRestarted) return t('terminal:status.daemonRestarted')
  if (exit.signal !== null) return t('terminal:status.exitedSignal', { signal: exit.signal })
  return t('terminal:status.exited', { code: exit.exitCode })
}

/** The custom title, else "Terminal N". */
export const tabLabel = (tab: TerminalTab, t: T): string =>
  tab.customTitle ?? t('terminal:tab.defaultTitle', { n: tab.ordinal })

/** The exit text of the first ended pane, or null while every pane runs. */
export function tabStatus(tab: TerminalTab, t: T): string | null {
  const exit = tab.panes.find((p) => p.exit)?.exit
  return exit ? exitText(exit, t) : null
}
