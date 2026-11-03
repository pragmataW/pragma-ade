import type { IpcContract, IpcEventContract } from '@pragma/sdk'
import { loadModuleRecord } from '@pragma/test-support'
import { rendererRecordOf, renderWithRendererHost } from '@pragma/test-support/dom'
import { act } from '@testing-library/react'
import { createStore } from 'zustand/vanilla'
import { PROJECTS_SLOTS, type WorktreeRowSlotProps } from '../../src/contract'
import { ProjectsSidebar } from '../../src/renderer/components/ProjectsSidebar'
import { type ProjectsRuntime, withRuntime } from '../../src/renderer/lib/runtime'
import { EMPTY_PROJECTS_STATE, type ProjectsIpc, type ProjectsState } from '../../src/renderer/store'
import { createUiStore } from '../../src/renderer/ui-store'
import { MODULE_DIR } from './builders'

export const STATUS_PROBE_TESTID = 'probe-status'

/** Stands in for agent-status: a `worktreeRow.leading` entry showing the worktree id. */
const statusProbe = {
  id: 'probe.status',
  order: 1,
  component: ({ worktreeId }: WorktreeRowSlotProps) => <span data-testid={STATUS_PROBE_TESTID}>{worktreeId}</span>,
}

type Answer = (input: unknown) => unknown

/**
 * The projects sidebar over a fixed store and a recording IPC (answers `{ ok: true }` unless `answers`
 * says otherwise), inside a real renderer host with the projects locale and a status slot probe.
 * Only the given renderer records' locales load (no module activates without a main host entry).
 */
export async function mountSidebar(state: Partial<ProjectsState>, answers: Record<string, Answer> = {}) {
  const calls: { channel: string; input: unknown }[] = []
  const ipc: ProjectsIpc = {
    invoke: async <I, O>(c: IpcContract<I, O>, input: I): Promise<O> => {
      calls.push({ channel: c.channel, input })
      return (answers[c.channel]?.(input) ?? { ok: true, value: undefined }) as O
    },
    subscribe: <P,>(_c: IpcEventContract<P>, _cb: (p: P) => void) => ({ dispose: () => undefined }),
  }
  const runtime: ProjectsRuntime = {
    store: createStore<ProjectsState>(() => ({ ...EMPTY_PROJECTS_STATE, hydrated: true, ...state })),
    ui: createUiStore(),
    ipc,
  }
  const record = await loadModuleRecord(MODULE_DIR)
  const Sidebar = withRuntime(runtime, ProjectsSidebar)
  const rendered = await renderWithRendererHost(<Sidebar />, { records: [rendererRecordOf(record)] })
  act(() => void rendered.host.registries.registerSlot(PROJECTS_SLOTS.worktreeRowLeading, statusProbe))
  return {
    ...rendered,
    runtime,
    /** Inputs sent on `channel`, oldest first. */
    callsOn: (channel: string) => calls.filter((c) => c.channel === channel).map((c) => c.input),
  }
}
export type SidebarHarness = Awaited<ReturnType<typeof mountSidebar>>
