import { CHAT_OPTION_KEYS, CUSTOM_PART_PREFIX } from '@pragma/module-chat/contract'
import { Gauge } from '@pragma/ui/icons'
import { AGENT_OPTION } from './constants'
import { FormCard } from './FormCard'
import {
  type ChatUiDefinition,
  ContextMeter,
  createOptionPicker,
  defaultChatUi,
  defaultComposerExtensions,
  ModelPicker,
  StopButton,
  UsageMeter,
} from './kit'
import { OpencodeErrorRow } from './OpencodeErrorRow'
import { CUSTOM } from './payloads'
import { RetryNotice } from './RetryNotice'

export const AgentPicker = createOptionPicker({ key: AGENT_OPTION })
export const VariantPicker = createOptionPicker({ key: CHAT_OPTION_KEYS.effort, variant: 'icon', icon: Gauge })

/** OpenCode's chat UI: the kit's core parts plus forms and retries; each line is one feature (remove it to drop it). */
export const opencodeChatUi: ChatUiDefinition = {
  parts: {
    ...defaultChatUi.parts,
    error: OpencodeErrorRow,
    [`${CUSTOM_PART_PREFIX}${CUSTOM.form}`]: FormCard,
    [`${CUSTOM_PART_PREFIX}${CUSTOM.retry}`]: RetryNotice,
  },
  header: [UsageMeter],
  composerToolbar: [AgentPicker, ModelPicker, VariantPicker, ContextMeter, StopButton],
  composerExtensions: defaultComposerExtensions,
}
