import { CHAT_OPTION_KEYS, CUSTOM_PART_PREFIX } from '@pragma/module-chat/contract'
import { Bot, Gauge } from '@pragma/ui/icons'
import { AGENT_OPTION, USER_MESSAGE_I18N } from './constants'
import { FormCard } from './FormCard'
import {
  type ChatUiDefinition,
  ContextMeter,
  createOptionPicker,
  createUserMessage,
  defaultChatUi,
  defaultComposerExtensions,
  documentAttachmentsExtension,
  McpStatus,
  PermissionModePicker,
  RateLimitBanner,
  RetryBanner,
  StopButton,
  UsageMeter,
} from './kit'
import { NoticeRow } from './NoticeRow'
import { OpencodeErrorRow } from './OpencodeErrorRow'
import { OpencodeModelPicker } from './OpencodeModelPicker'
import { CUSTOM } from './payloads'
import { opencodeSettingsPage } from './settings/settings-page'

export const AgentPicker = createOptionPicker({ key: AGENT_OPTION, icon: Bot })
export const VariantPicker = createOptionPicker({ key: CHAT_OPTION_KEYS.effort, variant: 'icon', icon: Gauge })

/**
 * OpenCode's chat UI: the kit's parts (task cards for subagents, questions, plans) plus forms, rewind/fork notices and
 * a provider-grouped model menu; each line is one feature (remove it to drop it).
 */
export const opencodeChatUi: ChatUiDefinition = {
  parts: {
    ...defaultChatUi.parts,
    message: createUserMessage(USER_MESSAGE_I18N),
    error: OpencodeErrorRow,
    [`${CUSTOM_PART_PREFIX}${CUSTOM.form}`]: FormCard,
    [`${CUSTOM_PART_PREFIX}${CUSTOM.notice}`]: NoticeRow,
  },
  header: [McpStatus, UsageMeter],
  banners: [RateLimitBanner, RetryBanner],
  composerToolbar: [PermissionModePicker, AgentPicker, OpencodeModelPicker, VariantPicker, ContextMeter, StopButton],
  composerExtensions: [...defaultComposerExtensions, documentAttachmentsExtension],
  settingsPage: opencodeSettingsPage,
}
