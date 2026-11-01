import { GitServiceToken, ProjectsServiceToken, worktreeChanged } from '@pragma/module-projects/contract'
import { defineMainModule } from '@pragma/sdk/main'
import {
  changesChangedEvent,
  GIT_CHANGES_SETTINGS_DEFAULTS,
  type GitChangesSettings,
  GitChangesSettingsSchema,
} from '../contract'
import { DiffService } from './diff-service'
import { registerIpc } from './ipc'

export default defineMainModule<GitChangesSettings>({
  settings: { schema: GitChangesSettingsSchema, defaults: GIT_CHANGES_SETTINGS_DEFAULTS },
  activate(ctx) {
    const git = ctx.services.get(GitServiceToken)
    const projects = ctx.services.get(ProjectsServiceToken)
    const diff = new DiffService({ git, maxFileBytes: () => ctx.settings.get().maxFileBytes })
    const publishChanged = (worktreeId: string) => ctx.ipc.publish(changesChangedEvent, { worktreeId })
    registerIpc(ctx, { diff, projects, publishChanged })
    // 01 already debounces file batches; commits and ref moves arrive as `reason: 'head'`.
    ctx.events.on(worktreeChanged, ({ worktreeId }) => publishChanged(worktreeId))
  },
})
