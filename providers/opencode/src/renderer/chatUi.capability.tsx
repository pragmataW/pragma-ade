import { defineRendererCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'
import { opencodeChatUi } from './chat/opencode-chat-ui'

export default defineRendererCapability(PROVIDER_ID, 'chatUi', opencodeChatUi)
