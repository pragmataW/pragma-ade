import { ProjectsRendererServiceToken } from '@pragma/module-projects/contract'
import { type TerminalViewProps, TerminalViewServiceToken } from '@pragma/module-terminal/contract'
import type { IpcContract, IpcEventContract } from '@pragma/sdk'
import type { CenterView, RendererContext, SlotEntry } from '@pragma/sdk/renderer'
import { RendererHostProvider } from '@pragma/sdk/renderer'
import { createCommandRegistry } from '@pragma/sdk/runtime/main'
import { act, render } from '@testing-library/react'
import type { ComponentType, ReactElement } from 'react'
import { createStore } from 'zustand/vanilla'
import {
  AGENTS_IPC,
  type AgentProfile,
  type AgentSession,
  type AgentsSettings,
  agentsSettingsDefaults,
} from '../../src/contract'
import renderer from '../../src/renderer/index'
import { getRuntime } from '../../src/renderer/runtime'
import { testI18n } from './render'

type Entry = SlotEntry<Record<string, unknown>>

export const FakeTerminalView: ComponentType<TerminalViewProps> = ({ ptyId }) => (
  <div data-testid="fake-terminal" data-pty-id={ptyId} />
)

export interface FakeBackend {
  sessions: AgentSession[]
  profiles: AgentProfile[]
  calls: [string, unknown][]
  /** Overrides per channel; default handlers serve `sessions`/`profiles`. */
  replies: Record<string, (input: unknown) => unknown>
}

function defaultReply(b: FakeBackend, channel: string, input: unknown): unknown {
  const i = input as { id?: string; worktreeId?: string }
  if (channel === AGENTS_IPC.listProfiles) return b.profiles
  if (channel === AGENTS_IPC.listProviders) return []
  if (channel === AGENTS_IPC.listSessions) return b.sessions.filter((s) => s.worktreeId === i.worktreeId)
  if (channel === AGENTS_IPC.getSession) return b.sessions.find((s) => s.id === i.id) ?? null
  return undefined
}

/** A renderer context with fake projects/terminal services and IPC; activates the real agents renderer module. */
export function activateWithFakeContext(
  opts: {
    sessions?: AgentSession[]
    profiles?: AgentProfile[]
    settings?: Partial<AgentsSettings>
    activeWorktree?: string | null
  } = {},
) {
  const slots = createStore<{ slots: Record<string, Entry[]> }>(() => ({ slots: {} }))
  let active: string | null = opts.activeWorktree === undefined ? 'w1' : opts.activeWorktree
  const listeners = new Set<() => void>()
  const backend: FakeBackend = { sessions: opts.sessions ?? [], profiles: opts.profiles ?? [], calls: [], replies: {} }
  const subscriptions = new Map<string, (p: unknown) => void>()
  const centerViews: CenterView[] = []
  const activatedViews: string[] = []
  const executed: [string, unknown][] = []
  const commands = createCommandRegistry()
  const setActive = (id: string | null) => {
    active = id
    for (const l of listeners) l()
  }
  commands.register('projects.selectWorktree', (a) => {
    executed.push(['projects.selectWorktree', a])
    setActive((a as { worktreeId: string }).worktreeId)
  })
  const services = new Map<string, unknown>([
    [
      ProjectsRendererServiceToken.id,
      {
        getActiveWorktree: () => (active ? { id: active } : null),
        subscribe: (l: () => void) => {
          listeners.add(l)
          return () => listeners.delete(l)
        },
      },
    ],
    [TerminalViewServiceToken.id, { TerminalView: FakeTerminalView }],
  ])
  const ctx = {
    module: { id: 'agents' },
    services: {
      get: (t: { id: string }) => services.get(t.id),
      tryGet: (t: { id: string }) => services.get(t.id),
      provide: () => undefined,
    },
    ipc: {
      async invoke<I, O>(c: IpcContract<I, O>, input: I): Promise<O> {
        backend.calls.push([c.channel, input])
        const reply = backend.replies[c.channel]
        return (reply ? reply(input) : defaultReply(backend, c.channel, input)) as O
      },
      subscribe<P>(c: IpcEventContract<P>, cb: (p: P) => void) {
        subscriptions.set(c.channel, cb as (p: unknown) => void)
        return { dispose: () => subscriptions.delete(c.channel) }
      },
    },
    commands,
    views: {
      registerCenterView: (v: CenterView) => {
        centerViews.push(v)
        return { dispose: () => undefined }
      },
      activate: (id: string) => void activatedViews.push(id),
    },
    slots: {
      register: (slotId: string, e: Entry) => {
        slots.setState((st) => ({
          slots: { ...st.slots, [slotId]: [...(st.slots[slotId] ?? []), e].sort((a, b) => a.order - b.order) },
        }))
        return { dispose: () => undefined }
      },
    },
    shortcuts: { register: () => ({ dispose: () => undefined }) },
    settingsPages: { register: () => ({ dispose: () => undefined }) },
    settings: { get: () => ({ ...agentsSettingsDefaults, ...opts.settings }), update: async () => undefined },
    providers: { icon: () => undefined },
  }
  renderer.activate(ctx as unknown as RendererContext<AgentsSettings>)
  return {
    ctx,
    backend,
    centerViews,
    activatedViews,
    executed,
    setActive: (id: string | null) => act(() => setActive(id)),
    registerSlot: ctx.slots.register,
    /** Delivers a main → renderer IPC event. */
    emit: (channel: string, payload: unknown) => act(() => subscriptions.get(channel)?.(payload)),
    store: () => getRuntime().store,
    /** Renders inside a minimal renderer host (the SDK `<Slot>` reads `registries.store`). */
    async render(ui: ReactElement) {
      const i18n = await testI18n()
      const host = { registries: { store: slots }, i18n }
      return render(<RendererHostProvider host={host as never}>{ui}</RendererHostProvider>)
    },
  }
}
