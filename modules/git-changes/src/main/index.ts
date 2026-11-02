import { GitServiceToken, ProjectsServiceToken, worktreeChanged } from '@pragma/module-projects/contract'
import { defineMainModule } from '@pragma/sdk/main'
import {
  changesChangedEvent,
  GIT_CHANGES_SETTINGS_DEFAULTS,
  type GitChangesSettings,
  GitChangesSettingsSchema,
  GitScmHooksToken,
} from '../contract'
import { DestructiveHooks } from './destructive-hooks'
import { DiffService } from './diff-service'
import { registerIpc } from './ipc'
import { registerScmIpc } from './scm-ipc'
import { ScmService } from './scm-service'

export default defineMainModule<GitChangesSettings>({
  settings: { schema: GitChangesSettingsSchema, defaults: GIT_CHANGES_SETTINGS_DEFAULTS },
  activate(ctx) {
    const git = ctx.services.get(GitServiceToken)
    const projects = ctx.services.get(ProjectsServiceToken)
    const diff = new DiffService({ git, maxFileBytes: () => ctx.settings.get().maxFileBytes })
    const publishChanged = (worktreeId: string) => ctx.ipc.publish(changesChangedEvent, { worktreeId })
    registerIpc(ctx, { diff, projects, publishChanged })
    const hooks = new DestructiveHooks(ctx.log)
    ctx.services.provide(GitScmHooksToken, hooks)
    const scm = new ScmService({
      git,
      hooks,
      pullRebase: () => ctx.settings.get().pullRebase,
      onChanged: publishChanged,
    })
    registerScmIpc(ctx, { scm, diff, projects })
    // 01 already debounces file batches; commits and ref moves arrive as `reason: 'head'`.
    ctx.events.on(worktreeChanged, ({ worktreeId }) => publishChanged(worktreeId))
  },
})
