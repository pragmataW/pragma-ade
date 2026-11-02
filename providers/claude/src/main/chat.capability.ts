import { defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'
import { createClaudeChatCapability } from './chat/capability'

export default defineCapability(PROVIDER_ID, 'chat', (capCtx) => createClaudeChatCapability(capCtx))
