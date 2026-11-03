import type { ChatUiDefinition } from '../../contract'
import { defaultComposerExtensions } from './composer/extensions'
import { ContextMeter } from './controls/ContextMeter'
import { McpStatus } from './controls/McpStatus'
import { ModelPicker } from './controls/ModelPicker'
import { PermissionModePicker } from './controls/PermissionModePicker'
import { StopButton } from './controls/StopButton'
import { UsageMeter } from './controls/UsageMeter'
import { AssistantText } from './parts/AssistantText'
import { RateLimitBanner, RetryBanner } from './parts/Banners'
import { ErrorRow } from './parts/ErrorRow'
import { FileEditDiff } from './parts/FileEditDiff'
import { SessionExitNotice, TurnEndNotice } from './parts/Notices'
import { PermissionCard } from './parts/PermissionCard'
import { PlanApprovalCard } from './parts/PlanApprovalCard'
import { QuestionCard } from './parts/QuestionCard'
import { TaskCard } from './parts/TaskCard'
import { ThinkingBlock } from './parts/ThinkingBlock'
import { TodoList } from './parts/TodoList'
import { ToolCallCard } from './parts/ToolCallCard'
import { UserMessage } from './parts/UserMessage'
import { TasksIndicator } from './tasks/TasksIndicator'
import { TasksPanel } from './tasks/TasksPanel'

/** The kit's definition for providers without a `chatUi` capability (all core parts). */
export const defaultChatUi: ChatUiDefinition = {
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
    task: TaskCard,
    question: QuestionCard,
    'plan-proposal': PlanApprovalCard,
  },
  header: [TasksIndicator, McpStatus, UsageMeter],
  sidePanels: [TasksPanel],
  banners: [RateLimitBanner, RetryBanner],
  composerToolbar: [PermissionModePicker, ModelPicker, ContextMeter, StopButton],
  composerExtensions: defaultComposerExtensions,
  groupToolCalls: true,
}
