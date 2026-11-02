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
import { createFakePlatform, type FakePlatform, loadModuleRecord } from '@pragma/test-support'
import { type RenderedWithHost, rendererRecordOf, renderWithRendererHost } from '@pragma/test-support/dom'
import { type ReactElement, useSyncExternalStore } from 'react'
import {
  fileContentsIpc,
  listBranchesIpc,
  listChangesIpc,
  scmApplyHunkIpc,
  scmCommitIpc,
  scmDiscardIpc,
  scmHunksIpc,
  scmRemoteIpc,
  scmStageIpc,
  scmStashClearIpc,
  scmStashFilesIpc,
  scmStashIpc,
  scmStashListIpc,
  scmStashPushIpc,
  scmStateIpc,
  scmUndoCommitIpc,
  scmUnstageIpc,
  setBaseBranchIpc,
} from '../../src/contract'
import renderer from '../../src/renderer/index'
import { setRendererCtx } from '../../src/renderer/lib/sdk'
import { useScmStore } from '../../src/renderer/scm/scm-store'
import { useGitChangesStore } from '../../src/renderer/store'
import { WT_ID } from './ids'

export { WT_ID }

const MODULE_DIR = join(import.meta.dirname, '..', '..')
const OWN_CONTRACTS: IpcContract<unknown, unknown>[] = [
  listChangesIpc,
  fileContentsIpc,
  listBranchesIpc,
  setBaseBranchIpc,
  scmStateIpc,
  scmHunksIpc,
  scmStageIpc,
  scmUnstageIpc,
  scmDiscardIpc,
  scmApplyHunkIpc,
  scmCommitIpc,
  scmUndoCommitIpc,
  scmStashListIpc,
  scmStashPushIpc,
  scmStashIpc,
  scmStashClearIpc,
  scmStashFilesIpc,
  scmRemoteIpc,
] as never

/** Source Control answers when a test gives none: a clean branch with an upstream, no stashes, no hunks, ok. */
const OK = { ok: true }
const SCM_DEFAULTS: Answers = {
  [scmStateIpc.channel]: () => ({ branch: 'feature', upstream: 'origin/feature', ahead: 0, behind: 0, hasHead: true }),
  [scmStashListIpc.channel]: () => ({ stashes: [] }),
  [scmHunksIpc.channel]: () => ({ hunks: [] }),
  [scmStashFilesIpc.channel]: () => ({ files: [] }),
  ...Object.fromEntries(
    [
      scmStageIpc,
      scmUnstageIpc,
      scmDiscardIpc,
      scmApplyHunkIpc,
      scmCommitIpc,
      scmUndoCommitIpc,
      scmStashPushIpc,
      scmStashIpc,
      scmStashClearIpc,
      scmRemoteIpc,
    ].map((c) => [c.channel, () => OK]),
  ),
}

/** An observer that never reports (jsdom has no layout); react-resizable-panels constructs one per group. */
class SilentResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const SEPARATOR_ATTR = 'data-separator'
const OFFSCREEN = -10_000
let separatorsMoved = false

/**
 * jsdom lays nothing out, so every element sits at 0,0 and react-resizable-panels' capture-phase pointer handler
 * takes every click for a separator drag; its separators are reported far off screen instead.
 */
function moveSeparatorsOffscreen(): void {
  if (separatorsMoved) return
  separatorsMoved = true
  const rectOf = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return this.hasAttribute(SEPARATOR_ATTR) ? new DOMRect(OFFSCREEN, OFFSCREEN, 1, 1) : rectOf.call(this)
  }
}

/** Radix Select/Popover and react-resizable-panels need these in jsdom. */
function polyfillDom(): void {
  moveSeparatorsOffscreen()
  const proto = Element.prototype as unknown as Record<string, unknown>
  proto.hasPointerCapture ??= () => false
  proto.releasePointerCapture ??= () => undefined
  proto.scrollIntoView ??= () => undefined
  globalThis.ResizeObserver ??= SilentResizeObserver as unknown as typeof ResizeObserver
}

type Answer = (input: never) => unknown
export type Answers = Partial<Record<string, Answer>>

const fakeRecord = (id: string, main: MainModule<unknown>, locales: ModuleRecord['locales'] = {}): ModuleRecord => ({
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
  locales,
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
  return Tab ? <Tab tabId="git-changes" visible /> : null
}

export interface PanelHarness extends RenderedWithHost {
  calls: [string, unknown][]
  callsOn(channel: string): unknown[]
  /** Every platform call (e.g. `dialogs.confirm` with its input). */
  platform: FakePlatform
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
    /** The `comments` namespace (e.g. send error texts). */
    commentLocales?: Record<string, unknown>
    /** Rendered instead of the Git Changes tab. */
    render?: ReactElement
    /** Renderer commands other modules would register (e.g. 06's `editor.openDiff`). */
    commands?: Record<string, (args: unknown) => unknown>
    /** The answer of every confirmation dialog (default: confirmed). */
    confirm?: boolean
  } = {},
): Promise<PanelHarness> {
  polyfillDom()
  useGitChangesStore.setState({ views: {}, treeCollapsed: null })
  useScmStore.setState({ feedback: {} })
  const calls: [string, unknown][] = []
  const answers = { ...SCM_DEFAULTS, ...opts.answers }
  const platform = createFakePlatform({ dialogReplies: { confirm: opts.confirm ?? true } })
  const own = await loadModuleRecord(MODULE_DIR)
  const ownMain = { ...answeringMain(OWN_CONTRACTS, answers, calls), settings: own.main?.settings }
  const ownRecord: ModuleRecord = { ...own, main: ownMain, testHooks: undefined }
  const projects = fakeRecord('projects', { activate: () => undefined })
  const comments = fakeRecord('comments', answeringMain(opts.commentContracts ?? [], answers, calls), {
    en: (opts.commentLocales ?? {}) as ModuleRecord['locales'][string],
  })
  const projectsService = fakeProjects(opts.active === undefined ? aWorktree() : opts.active, opts.changedFiles ?? {})
  const projectsRenderer: RendererModule<never> = {
    activate: (ctx) => {
      ctx.services.provide(ProjectsRendererServiceToken, projectsService)
      for (const [id, run] of Object.entries(opts.commands ?? {})) ctx.commands.register(id, run)
    },
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
  const r = await renderWithRendererHost(opts.render ?? <GitChangesTab />, {
    platform,
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
    platform,
    callsOn: (channel) => calls.filter(([c]) => c === channel).map(([, i]) => i),
    async dispose() {
      await r.dispose()
      setRendererCtx(undefined)
    },
  }
}
