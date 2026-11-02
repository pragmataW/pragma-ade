import { AgentSessionsServiceToken } from '@pragma/module-agents/contract'
import { ChatServiceToken } from '@pragma/module-chat/contract'
import { CommentsServiceToken } from '@pragma/module-comments/contract'
import { ProjectsServiceToken } from '@pragma/module-projects/contract'
import { defineMainModule } from '@pragma/sdk/main'
import { ChatSwitchServiceToken, ExternalSessionGuardToken } from '../contract'
import { activateChatSwitch, type ChatSwitchMain } from './activate'
import { setChatSwitchRuntime } from './runtime'

let main: ChatSwitchMain | undefined

export default defineMainModule({
  activate(ctx) {
    const projects = ctx.services.get(ProjectsServiceToken)
    main = activateChatSwitch({
      agents: ctx.services.get(AgentSessionsServiceToken),
      chat: ctx.services.get(ChatServiceToken),
      comments: ctx.services.get(CommentsServiceToken),
      providers: ctx.providers,
      events: ctx.events,
      ipc: ctx.ipc,
      worktreePath: async (id) => (await projects.getWorktree(id))?.path ?? null,
      provide: (guard, service) => {
        ctx.services.provide(ExternalSessionGuardToken, guard)
        ctx.services.provide(ChatSwitchServiceToken, service)
      },
      log: ctx.log,
    })
    setChatSwitchRuntime(main)
  },
  async deactivate() {
    await main?.dispose()
    main = undefined
    setChatSwitchRuntime(undefined)
  },
})
