import { CHAT_OPTION_KEYS, CUSTOM_PART_PREFIX } from '@pragma/module-chat/contract'
import { Gauge } from '@pragma/ui/icons'
import { CLAUDE_CUSTOM_EVENTS } from '../../main/chat/constants'
import { CompactBoundaryNotice } from './CompactBoundaryNotice'
import { REWIND_I18N } from './constants'
import { FastModeToggle } from './FastModeToggle'
import {
  type ChatUiDefinition,
  ContextMeter,
  createOptionPicker,
  createUserMessage,
  defaultChatUi,
  documentAttachmentsExtension,
  fileMentionExtension,
  imageAttachmentsExtension,
  McpStatus,
  ModelPicker,
  PermissionModePicker,
  RateLimitBanner,
  RetryBanner,
  StopButton,
  slashCommandsExtension,
  TasksIndicator,
  TasksPanel,
  UsageMeter,
} from './kit'

export const EffortPicker = createOptionPicker({ key: CHAT_OPTION_KEYS.effort, variant: 'icon', icon: Gauge })

/**
 * Claude's chat UI: every kit part (text, thinking, tools, diffs, todos, permissions, subagent / workflow task
 * cards, question and plan approval cards) plus file rewind on user messages and the compact-boundary notice; each other line is one feature.
 */
export const claudeChatUi: ChatUiDefinition = {
  parts: {
    ...defaultChatUi.parts,
    message: createUserMessage(REWIND_I18N),
    [`${CUSTOM_PART_PREFIX}${CLAUDE_CUSTOM_EVENTS.compactBoundary}`]: CompactBoundaryNotice,
  },
  banners: [RateLimitBanner, RetryBanner],
  header: [TasksIndicator, McpStatus, UsageMeter],
  sidePanels: [TasksPanel],
  composerToolbar: [PermissionModePicker, ModelPicker, EffortPicker, FastModeToggle, ContextMeter, StopButton],
  // documents before images: the image extension leaves PDFs and text files to it
  composerExtensions: [
    slashCommandsExtension,
    fileMentionExtension,
    documentAttachmentsExtension,
    imageAttachmentsExtension,
  ],
}
