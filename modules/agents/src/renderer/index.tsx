import { projectsCommands } from '@pragma/module-projects/contract'
import { SETTINGS_PAGE_ORDER } from '@pragma/sdk'
import { defineRendererModule, type RendererContext } from '@pragma/sdk/renderer'
import {
  AGENT_SLOTS,
  AGENTS_COMMANDS,
  AGENTS_MODULE_ID,
  AGENTS_VIEW_ID,
  type AgentSessionViewProps,
  type AgentsSettings,
  agentsIpc,
  agentsIpcEvents,
  focusSessionArgsSchema,
  openLauncherArgsSchema,
  TERMINAL_MODE,
} from '../contract'
import { AgentsCenterView } from './center/AgentsCenterView'
import { TerminalSessionView } from './center/TerminalSessionView'
import { setRuntime } from './runtime'
import { AgentsSettingsPage } from './settings/AgentsSettingsPage'
import { type AgentsStore, createAgentsStore } from './store'

const VIEW_ICON = 'bot'
const TERMINAL_VIEW_ORDER = 10

/** `agents.focusSession`: select the session's worktree, show the agents view, select its tab (04's notifications). */
async function focusSession(ctx: RendererContext<AgentsSettings>, store: AgentsStore, args: unknown): Promise<void> {
  const { sessionId } = focusSessionArgsSchema.parse(args)
  const session = await ctx.ipc.invoke(agentsIpc.getSession, { id: sessionId })
  if (!session) {
    console.warn(`agents.focusSession: unknown session ${sessionId}`)
    return
  }
  await ctx.commands.execute(projectsCommands.selectWorktree.id, { worktreeId: session.worktreeId })
  ctx.views.activate(AGENTS_VIEW_ID)
  store.getState().applySessionChanged({ session, reveal: true })
  store.getState().selectSession(session.worktreeId, session.id)
}

function registerCommands(ctx: RendererContext<AgentsSettings>, store: AgentsStore): void {
  ctx.commands.register(
    AGENTS_COMMANDS.openLauncher,
    (a) => store.getState().openLauncher(openLauncherArgsSchema.parse(a ?? {}).worktreeId ?? null),
    { titleKey: 'agents:commands.openLauncher', palette: true },
  )
  ctx.commands.register(AGENTS_COMMANDS.focusSession, (a) => focusSession(ctx, store, a), {
    titleKey: 'agents:commands.focusSession',
    palette: false,
  })
}

export default defineRendererModule<AgentsSettings>({
  activate(ctx) {
    const store = createAgentsStore(ctx.ipc, (m, e) => console.warn(`agents: ${m}`, e))
    setRuntime({ ctx, store })
    ctx.ipc.subscribe(agentsIpcEvents.sessionChanged, (p) => store.getState().applySessionChanged(p))
    ctx.ipc.subscribe(agentsIpcEvents.profilesChanged, (p) => store.getState().applyProfilesChanged(p))
    store
      .getState()
      .init()
      .catch((e: unknown) => console.warn('agents: init failed', e))
    ctx.views.registerCenterView({
      id: AGENTS_VIEW_ID,
      titleKey: 'agents:module.name',
      icon: VIEW_ICON,
      default: true,
      component: AgentsCenterView,
    })
    ctx.slots.register<AgentSessionViewProps>(AGENT_SLOTS.view, {
      id: TERMINAL_MODE,
      order: TERMINAL_VIEW_ORDER,
      match: (p) => p.session.mode === TERMINAL_MODE,
      component: TerminalSessionView,
    })
    ctx.settingsPages.register({
      id: AGENTS_MODULE_ID,
      titleKey: 'agents:settings.title',
      order: SETTINGS_PAGE_ORDER.agents,
      icon: VIEW_ICON,
      component: AgentsSettingsPage,
    })
    registerCommands(ctx, store)
  },
})
