import { defineRendererCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'
import { claudeChatUi } from './chat/claude-chat-ui'

export default defineRendererCapability(PROVIDER_ID, 'chatUi', claudeChatUi)
