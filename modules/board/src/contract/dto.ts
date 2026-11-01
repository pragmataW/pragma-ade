import { AgentStatusSchema } from '@pragma/module-agent-status/contract'
import { z } from '@pragma/sdk'
import {
  BOARD_ERROR,
  BOARD_ERROR_CODES,
  BRANCH_CHECK_REASONS,
  LABEL_COLORS,
  LIMITS,
  PRIORITIES,
  RESULT_TAG,
  SCOPE_KIND,
  START_STAGES,
} from './constants'

/** Upstream ids (project, worktree, session, profile) are non-empty strings. */
export const IdSchema = z.string().min(1)
export type Id = z.infer<typeof IdSchema>
export type ProjectId = Id
export type AgentSessionId = Id

export const PrioritySchema = z.enum(PRIORITIES)
export type Priority = z.infer<typeof PrioritySchema>
export const LabelColorSchema = z.enum(LABEL_COLORS)
export type LabelColor = z.infer<typeof LabelColorSchema>
export const BoardErrorCodeSchema = z.enum(BOARD_ERROR_CODES)
export type BoardErrorCode = z.infer<typeof BoardErrorCodeSchema>

/** Board-owned ids are integers. */
const intId = z.number().int().positive()
export const TaskIdSchema = intId
export type TaskId = z.infer<typeof TaskIdSchema>
export const BoardIdSchema = intId
export type BoardId = z.infer<typeof BoardIdSchema>
export const ColumnIdSchema = intId
export type ColumnId = z.infer<typeof ColumnIdSchema>
export const LabelIdSchema = intId
export type LabelId = z.infer<typeof LabelIdSchema>

export const NameSchema = z.string().trim().min(1).max(LIMITS.nameMax)
/** number = column id; string = column name (trimmed, case-insensitive, within the task's board). */
export const ColumnRefSchema = z.union([ColumnIdSchema, NameSchema])
export type ColumnRef = z.infer<typeof ColumnRefSchema>
/** number or all-digit string = task id; otherwise a key like `PRA-12` (case-insensitive). */
export const TaskRefSchema = z.union([TaskIdSchema, z.string().trim().min(1)])
export type TaskRef = z.infer<typeof TaskRefSchema>
/** number = label id of the task's board; string = label name, auto-created on write. */
export const LabelRefSchema = z.union([LabelIdSchema, NameSchema])
export type LabelRef = z.infer<typeof LabelRefSchema>

export const TaskPositionSchema = z.object({
  afterTaskId: TaskIdSchema.optional(),
  beforeTaskId: TaskIdSchema.optional(),
})
export type TaskPosition = z.infer<typeof TaskPositionSchema>
export const ColumnPositionSchema = z.object({
  afterColumnId: ColumnIdSchema.optional(),
  beforeColumnId: ColumnIdSchema.optional(),
})
export type ColumnPosition = z.infer<typeof ColumnPositionSchema>

export const BoardDtoSchema = z.object({
  id: BoardIdSchema,
  projectId: IdSchema,
  name: z.string(),
  keyPrefix: z.string(),
})
export type BoardDto = z.infer<typeof BoardDtoSchema>
export const ColumnDtoSchema = z.object({
  id: ColumnIdSchema,
  boardId: BoardIdSchema,
  name: z.string(),
  sortKey: z.string(),
})
export type ColumnDto = z.infer<typeof ColumnDtoSchema>
export const LabelDtoSchema = z.object({
  id: LabelIdSchema,
  boardId: BoardIdSchema,
  name: z.string(),
  color: LabelColorSchema,
})
export type LabelDto = z.infer<typeof LabelDtoSchema>

export const LinkedSessionDtoSchema = z.object({
  sessionId: IdSchema,
  worktreeId: IdSchema,
  title: z.string().nullable(),
  /** null when agent-status is absent or does not track the session. */
  status: AgentStatusSchema.nullable(),
  turnCompleted: z.boolean(),
  profileId: IdSchema.nullable(),
  /** null for built-in profiles: the UI translates `profileDisplayNameKey` instead. */
  profileName: z.string().nullable(),
  profileDisplayNameKey: z.string().nullable(),
  providerId: z.string().nullable(),
})
export type LinkedSessionDto = z.infer<typeof LinkedSessionDtoSchema>

export const TaskDtoSchema = z.object({
  id: TaskIdSchema,
  key: z.string(),
  number: z.number().int(),
  boardId: BoardIdSchema,
  projectId: IdSchema,
  columnId: ColumnIdSchema,
  title: z.string(),
  descriptionMd: z.string(),
  priority: PrioritySchema,
  labelIds: z.array(LabelIdSchema),
  worktreeId: IdSchema.nullable(),
  sortKey: z.string(),
  sessions: z.array(LinkedSessionDtoSchema),
  /** Every linked session id, including ones whose record is gone. */
  sessionIds: z.array(IdSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type TaskDto = z.infer<typeof TaskDtoSchema>

export const BoardScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal(SCOPE_KIND.project), projectId: IdSchema }),
  z.object({ kind: z.literal(SCOPE_KIND.all) }),
])
export type BoardScope = z.infer<typeof BoardScopeSchema>

export const BoardSectionSchema = z.object({
  board: BoardDtoSchema,
  projectName: z.string(),
  columns: z.array(ColumnDtoSchema),
  labels: z.array(LabelDtoSchema),
})
export type BoardSection = z.infer<typeof BoardSectionSchema>
export const BoardSnapshotSchema = z.object({
  scope: BoardScopeSchema,
  sections: z.array(BoardSectionSchema),
  tasks: z.array(TaskDtoSchema),
  statusAvailable: z.boolean(),
})
export type BoardSnapshot = z.infer<typeof BoardSnapshotSchema>

export const TaskFilterSchema = z.object({
  projectId: IdSchema.optional(),
  column: ColumnRefSchema.optional(),
  worktreeId: IdSchema.optional(),
  /** Tasks linked to this agent session (phase 10). */
  sessionId: IdSchema.optional(),
  labels: z.array(LabelRefSchema).optional(),
  priorities: z.array(PrioritySchema).optional(),
  hasWorktree: z.boolean().optional(),
  query: z.string().optional(),
})
export type TaskFilter = z.infer<typeof TaskFilterSchema>

export const CreateTaskInputSchema = z.object({
  projectId: IdSchema,
  title: z.string().trim().min(1).max(LIMITS.titleMax),
  descriptionMd: z.string().max(LIMITS.descriptionMax).optional(),
  priority: PrioritySchema.optional(),
  labels: z.array(LabelRefSchema).optional(),
  column: ColumnRefSchema.optional(),
  position: TaskPositionSchema.optional(),
  worktreeId: IdSchema.nullable().optional(),
})
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>
export const UpdateTaskPatchSchema = CreateTaskInputSchema.pick({
  title: true,
  descriptionMd: true,
  priority: true,
  labels: true,
  worktreeId: true,
}).partial()
export type UpdateTaskPatch = z.infer<typeof UpdateTaskPatchSchema>

export const StartProfileSchema = z.object({
  id: IdSchema,
  name: z.string().nullable(),
  displayNameKey: z.string().nullable(),
  providerId: z.string(),
  isDefault: z.boolean(),
})
export type StartProfile = z.infer<typeof StartProfileSchema>
export const StartWorktreeSchema = z.object({
  id: IdSchema,
  branch: z.string().nullable(),
  path: z.string(),
  isMain: z.boolean(),
})
export type StartWorktree = z.infer<typeof StartWorktreeSchema>
export const StartPrepSchema = z.object({
  taskId: TaskIdSchema,
  projectId: IdSchema,
  suggestedBranch: z.string(),
  baseBranches: z.array(z.string()),
  defaultBaseBranch: z.string().nullable(),
  profiles: z.array(StartProfileSchema),
  defaultProfileId: IdSchema.nullable(),
  worktrees: z.array(StartWorktreeSchema),
})
export type StartPrep = z.infer<typeof StartPrepSchema>

export const StartInWorktreeInputSchema = z.object({
  taskId: TaskIdSchema,
  worktreeId: IdSchema,
  profileId: IdSchema.optional(),
  /** Omitted → the `sendPromptByDefault` setting. */
  sendPrompt: z.boolean().optional(),
  promptOverride: z.string().optional(),
})
export type StartInWorktreeInput = z.infer<typeof StartInWorktreeInputSchema>
export const StartInNewWorktreeInputSchema = StartInWorktreeInputSchema.omit({ worktreeId: true }).extend({
  branch: z.string().trim().min(1),
  baseBranch: z.string().optional(),
})
export type StartInNewWorktreeInput = z.infer<typeof StartInNewWorktreeInputSchema>

export const StartTaskResultSchema = z.discriminatedUnion(RESULT_TAG, [
  z.object({
    ok: z.literal(true),
    worktreeId: IdSchema,
    sessionId: IdSchema,
    movedToColumnId: ColumnIdSchema.nullable(),
  }),
  z.object({
    ok: z.literal(false),
    stage: z.enum(START_STAGES),
    code: BoardErrorCodeSchema,
    message: z.string(),
    worktreeId: IdSchema.optional(),
  }),
])
export type StartTaskResult = z.infer<typeof StartTaskResultSchema>
export const BranchCheckSchema = z.discriminatedUnion(RESULT_TAG, [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), reason: z.enum(BRANCH_CHECK_REASONS) }),
])
export type BranchCheck = z.infer<typeof BranchCheckSchema>

/** Settings section key = module id. */
export const BoardSettingsSchema = z.object({
  sendPromptByDefault: z.boolean(),
  moveToInProgressOnStart: z.boolean(),
})
export type BoardSettings = z.infer<typeof BoardSettingsSchema>
export const BOARD_SETTINGS_DEFAULTS: BoardSettings = { sendPromptByDefault: true, moveToInProgressOnStart: true }

export const BoardErrorDtoSchema = z.object({ code: BoardErrorCodeSchema, message: z.string() })
export type BoardErrorDto = z.infer<typeof BoardErrorDtoSchema>

/** Every expected failure of the board; crosses IPC as `BoardErrorDto`. */
export class BoardError extends Error {
  readonly code: BoardErrorCode
  constructor(code: BoardErrorCode, message: string) {
    super(message)
    this.name = 'BoardError'
    this.code = code
  }
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Serializable form of any error; unknown errors become `validation` with their message. */
export function toBoardErrorDto(e: unknown, fallback: BoardErrorCode = BOARD_ERROR.validation): BoardErrorDto {
  if (e instanceof BoardError) return { code: e.code, message: e.message }
  return { code: fallback, message: errorMessage(e) }
}
