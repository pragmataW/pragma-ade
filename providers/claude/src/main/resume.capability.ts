import {
  INVALID_EXTERNAL_ID_MESSAGE,
  isSafeExternalSessionId,
  type ResumeCapability,
} from '@pragma/module-chat-switch/contract'
import { defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'
import { hasClaudeConversation } from './resume/conversation'

const RESUME_FLAG = '--resume'

/**
 * 11c: interactive resume = `claude --resume <id>` (verified: claude 2.1.316 `-r, --resume [value]`). `serverUrl` is
 * ignored; the chat adapter resumes through the SDK (`--resume` on the stream-json child). `hasConversation`: the
 * CLI's transcript file exists (none before the first message).
 */
export const claudeResumeCapability: ResumeCapability = {
  canResumeInChat: true,
  terminalResumeArgs({ externalSessionId }) {
    if (!isSafeExternalSessionId(externalSessionId)) throw new Error(INVALID_EXTERNAL_ID_MESSAGE)
    return { args: [RESUME_FLAG, externalSessionId], env: {} }
  },
  hasConversation: hasClaudeConversation,
}

export default defineCapability(PROVIDER_ID, 'resume', claudeResumeCapability)
