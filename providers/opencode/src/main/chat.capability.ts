import { defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'
import { createOpencodeChat } from './chat/factory'

export default defineCapability(PROVIDER_ID, 'chat', (capCtx) => createOpencodeChat(capCtx))
