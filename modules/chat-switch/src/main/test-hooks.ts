import { defineTestHooks } from '@pragma/sdk/main'
import { chatSwitchTestIpc } from '../contract'
import { getChatSwitchRuntime } from './runtime'

/** PRAGMA_TEST only: the guard owner of an external id, and switching the serve retain off (standalone path). */
export default defineTestHooks((ctx) => {
  ctx.ipc.handle(chatSwitchTestIpc.guardOwner, (key) => {
    const owner = getChatSwitchRuntime().guard.ownerOf(key)
    return owner === undefined ? {} : { ownerSessionId: owner }
  })
  ctx.ipc.handle(chatSwitchTestIpc.disableRetain, ({ disabled }) => getChatSwitchRuntime().setRetainDisabled(disabled))
})
