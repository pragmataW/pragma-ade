import { join } from 'node:path'
import { type DestructiveSnapshot, GitScmHooksToken } from '@pragma/module-git-changes/contract'
import { GitServiceToken } from '@pragma/module-projects/contract'
import type { Disposable } from '@pragma/sdk'
import { defineMainModule, type MainContext } from '@pragma/sdk/main'
import { BLOB_DIR, PRUNE_INTERVAL_MS } from '../constants'
import {
  LocalHistoryIpc,
  type LocalHistoryService,
  LocalHistoryServiceToken,
  type LocalHistorySettings,
  LocalHistorySettingsSchema,
  type RecordInput,
} from '../contract'
import { createBlobStore } from './blobs'
import { createHistoryStore } from './store'

/** What Git Changes is about to throw away, as a history entry. */
export const toRecordInput = (s: DestructiveSnapshot): RecordInput => ({
  worktreeId: s.worktreeId,
  cwd: s.cwd,
  reason: s.reason,
  paths: s.paths,
  stashes: s.stashes.map(({ sha, message }) => ({ sha, message })),
  headSha: s.headSha,
})

let timer: ReturnType<typeof setInterval> | undefined
const subscriptions: Disposable[] = []

function registerIpc(ipc: MainContext['ipc'], s: LocalHistoryService): void {
  ipc.handle(LocalHistoryIpc.list, ({ worktreeId }) => s.list(worktreeId))
  ipc.handle(LocalHistoryIpc.detail, ({ id }) => s.detail(id))
  ipc.handle(LocalHistoryIpc.fileContent, ({ id, path }) => s.fileContent(id, path))
  ipc.handle(LocalHistoryIpc.restore, ({ id, paths }) => s.restore(id, paths))
  ipc.handle(LocalHistoryIpc.remove, ({ id }) => s.remove(id))
  ipc.handle(LocalHistoryIpc.clear, () => s.clear())
}

export default defineMainModule<LocalHistorySettings>({
  settings: { schema: LocalHistorySettingsSchema, defaults: LocalHistorySettingsSchema.parse({}) },
  migrations: true,
  activate(ctx) {
    const store = createHistoryStore({
      db: ctx.db,
      blobs: createBlobStore(join(ctx.module.paths.data, BLOB_DIR)),
      settings: () => ctx.settings.get(),
      git: () => ctx.services.tryGet(GitServiceToken),
      onChanged: () => ctx.ipc.publish(LocalHistoryIpc.changed, undefined),
    })
    ctx.services.provide(LocalHistoryServiceToken, store)
    registerIpc(ctx.ipc, store)
    const hooks = ctx.services.tryGet(GitScmHooksToken)
    if (hooks) subscriptions.push(hooks.onBeforeDestructive(async (s) => void (await store.record(toRecordInput(s)))))
    store.prune()
    timer = setInterval(() => store.prune(), PRUNE_INTERVAL_MS)
    timer.unref?.()
  },
  deactivate() {
    clearInterval(timer)
    for (const s of subscriptions.splice(0)) s.dispose()
  },
})
