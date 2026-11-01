import type { RendererContext } from '@pragma/sdk/renderer'
import { RIGHT_TAB_ID, TERMINAL_COMMANDS } from '../constants'
import { SPLIT, type TerminalSettings } from '../contract'
import { closeTab, newTab, splitTab } from './panel/actions'
import type { Workspace } from './panel/workspace-store'

/** Palette commands; each acts on the active worktree's active tab and brings the Terminal tab forward. */
export function registerCommands(ctx: RendererContext<TerminalSettings>, workspace: Workspace): void {
  const show = (run: () => void) => () => {
    ctx.panels.activateRightTab(RIGHT_TAB_ID)
    run()
  }
  const entries: [string, () => void][] = [
    [TERMINAL_COMMANDS.newTab, newTab],
    [TERMINAL_COMMANDS.closeTab, () => closeTab()],
    [TERMINAL_COMMANDS.splitVertical, () => splitTab(SPLIT.vertical)],
    [TERMINAL_COMMANDS.splitHorizontal, () => splitTab(SPLIT.horizontal)],
    [TERMINAL_COMMANDS.focusSearch, () => workspace.store.setState((s) => ({ searchRequest: s.searchRequest + 1 }))],
  ]
  const titles: Record<string, string> = {
    [TERMINAL_COMMANDS.newTab]: 'terminal:commands.newTab',
    [TERMINAL_COMMANDS.closeTab]: 'terminal:commands.closeTab',
    [TERMINAL_COMMANDS.splitVertical]: 'terminal:commands.splitVertical',
    [TERMINAL_COMMANDS.splitHorizontal]: 'terminal:commands.splitHorizontal',
    [TERMINAL_COMMANDS.focusSearch]: 'terminal:commands.focusSearch',
  }
  for (const [id, run] of entries) ctx.commands.register(id, show(run), { titleKey: titles[id], palette: true })
}
