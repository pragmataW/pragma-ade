import { CHAT_OPTION_KEYS, CUSTOM_PART_PREFIX } from '@pragma/module-chat/contract'
import { Gauge } from '@pragma/ui/icons'
import { CLAUDE_CUSTOM_EVENTS } from '../../main/chat/constants'
import { CompactBoundaryNotice } from './CompactBoundaryNotice'
import {
  AssistantText,
  type ChatUiDefinition,
  ContextMeter,
  createOptionPicker,
  defaultComposerExtensions,
  ErrorRow,
  FileEditDiff,
  ModelPicker,
  PermissionCard,
  SessionExitNotice,
  StopButton,
  ThinkingBlock,
  TodoList,
  ToolCallCard,
  TurnEndNotice,
  UsageMeter,
  UserMessage,
} from './kit'

export const EffortPicker = createOptionPicker({ key: CHAT_OPTION_KEYS.effort, variant: 'icon', icon: Gauge })
export const PermissionModePicker = createOptionPicker({ key: CHAT_OPTION_KEYS.permissionMode })

/** Claude's chat UI: each line is one feature (remove a line to drop it). */
export const claudeChatUi: ChatUiDefinition = {
  parts: {
    message: UserMessage,
    'text-delta': AssistantText,
    thinking: ThinkingBlock,
    'tool-call': ToolCallCard,
    'file-edit': FileEditDiff,
    todo: TodoList,
    'permission-request': PermissionCard,
    error: ErrorRow,
    'turn-end': TurnEndNotice,
    'session-exit': SessionExitNotice,
    [`${CUSTOM_PART_PREFIX}${CLAUDE_CUSTOM_EVENTS.compactBoundary}`]: CompactBoundaryNotice,
  },
  header: [UsageMeter],
  composerToolbar: [ModelPicker, EffortPicker, PermissionModePicker, ContextMeter, StopButton],
  composerExtensions: defaultComposerExtensions,
}
