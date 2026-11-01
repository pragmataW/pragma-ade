import { join } from 'node:path'
import { type CommentsUiService, CommentsUiServiceToken } from '@pragma/module-comments/contract'
import {
  type ProjectsRendererService,
  ProjectsRendererServiceToken,
  type ProjectsSnapshot,
  type Worktree,
} from '@pragma/module-projects/contract'
import type { IpcContract, ModuleManifest } from '@pragma/sdk'
import type { MainModule } from '@pragma/sdk/main'
import { type RendererModule, useRendererHost } from '@pragma/sdk/renderer'
import type { ModuleRecord } from '@pragma/sdk/runtime/main'
import { loadModuleRecord } from '@pragma/test-support'
import { type RenderedWithHost, rendererRecordOf, renderWithRendererHost } from '@pragma/test-support/dom'
import { useSyncExternalStore } from 'react'
import { fileContentsIpc, listBranchesIpc, listChangesIpc, setBaseBranchIpc } from '../../src/contract'
import renderer from '../../src/renderer/index'
import { setRendererCtx } from '../../src/renderer/lib/sdk'
import { useGitChangesStore } from '../../src/renderer/store'

const MODULE_DIR = join(import.meta.dirname, '..', '..')
const OWN_CONTRACTS: IpcContract<unknown, unknown>[] = [
  listChangesIpc,
  fileContentsIpc,
  listBranchesIpc,
  setBaseBranchIpc,
] as never
export const WT_ID = 'w'

/** Radix Select/Popover need these in jsdom. */
function polyfillPointer(): void {
  const proto = Element.prototype as unknown as Record<string, unknown>
  proto.hasPointerCapture ??= () => false
  proto.releasePointerCapture ??= () => undefined
  proto.scrollIntoView ??= () => undefined
}

type Answer = (input: never) => unknown
export type Answers = Partial<Record<string, Answer>>

const fakeRecord = (id: string, main: MainModule<unknown>): ModuleRecord => ({
  manifest: {
    id,
    kind: 'feature',
    displayNameKey: `${id}:module.name`,
    dependsOn: [],
    optionalDependsOn: [],
    core: false,
  } as ModuleManifest,
  packageName: `@fake/${id}`,
  version: '0.0.0',
  dir: MODULE_DIR,
  extraResources: [],
  migrations: [],
  locales: {},
  main,
})

/** Main modules answering IPC from `answers` (channel → handler) and recording every call in `calls`. */
function answeringMain(contracts: IpcContract<unknown, unknown>[], answers: Answers, calls: [string, unknown][]) {
  return {
    activate(ctx: Parameters<MainModule<unknown>['activate']>[0]) {
      for (const c of contracts)
        ctx.ipc.handle(c, (input) => {
          calls.push([c.channel, input])
          return (answers[c.channel] as ((i: unknown) => unknown) | undefined)?.(input)
        })
    },
  }
}

function fakeProjects(active: Worktree | null, changedFiles: Record<string, number>): ProjectsRendererService {
  const snapshot = { changedFiles } as unknown as ProjectsSnapshot
  return {
    getActiveWorktree: () => active,
    getSnapshot: () => snapshot,
    subscribe: () => () => undefined,
    selectWorktree: async () => undefined,
  }
}

export const aWorktree = (over: Partial<Worktree> = {}): Worktree => ({
  id: WT_ID,
  projectId: 'p',
  path: '/repo',
  branch: 'feature',
  baseBranch: 'main',
  isMain: true,
  createdAt: 0,
  archivedAt: null,
  ...over,
})

const NoComposer = () => null

function GitChangesTab() {
  const { registries } = useRendererHost()
  const tabs = useSyncExternalStore(registries.store.subscribe, () => registries.store.getState().tabs)
  const Tab = tabs.find((t) => t.id === 'git-changes')?.component
  return Tab ? <Tab tabId="git-changes" /> : null
}

export interface PanelHarness extends RenderedWithHost {
  calls: [string, unknown][]
  callsOn(channel: string): unknown[]
}

/**
 * The real renderer module inside a real host: fake `projects` (active worktree, changed counts) and `comments`
 * (UI service, IPC) modules, and a git-changes main side whose IPC answers come from `answers`.
 */
export async function mountPanel(
  opts: {
    answers?: Answers
    active?: Worktree | null
    changedFiles?: Record<string, number>
    ui?: Partial<CommentsUiService>
    commentContracts?: IpcContract<unknown, unknown>[]
  } = {},
): Promise<PanelHarness> {
  polyfillPointer()
  useGitChangesStore.setState({ views: {} })
  const calls: [string, unknown][] = []
  const answers = opts.answers ?? {}
  const own = await loadModuleRecord(MODULE_DIR)
  const ownMain = { ...answeringMain(OWN_CONTRACTS, answers, calls), settings: own.main?.settings }
  const ownRecord: ModuleRecord = { ...own, main: ownMain, testHooks: undefined }
  const projects = fakeRecord('projects', { activate: () => undefined })
  const comments = fakeRecord('comments', answeringMain(opts.commentContracts ?? [], answers, calls))
  const projectsService = fakeProjects(opts.active === undefined ? aWorktree() : opts.active, opts.changedFiles ?? {})
  const projectsRenderer: RendererModule<never> = {
    activate: (ctx) => void ctx.services.provide(ProjectsRendererServiceToken, projectsService),
  }
  const ui: CommentsUiService = {
    CommentComposer: NoComposer,
    openDrawer: () => undefined,
    send: async () => undefined,
    ...opts.ui,
  }
  const commentsRenderer: RendererModule<never> = {
    activate: (ctx) => void ctx.services.provide(CommentsUiServiceToken, ui),
  }
  const r = await renderWithRendererHost(<GitChangesTab />, {
    mainModules: [projects, comments, ownRecord],
    records: [
      rendererRecordOf(projects, projectsRenderer),
      rendererRecordOf(comments, commentsRenderer),
      rendererRecordOf(ownRecord, renderer as never),
    ],
  })
  return {
    ...r,
    calls,
    callsOn: (channel) => calls.filter(([c]) => c === channel).map(([, i]) => i),
    async dispose() {
      await r.dispose()
      setRendererCtx(undefined)
    },
  }
}
