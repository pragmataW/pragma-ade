import { AgentStatusSchema } from '@pragma/module-agent-status/contract'
import { defineIpc, defineIpcEvent, type Result, z } from '@pragma/sdk'
import { BOARD_CHANNELS as C, BOARD_IPC_EVENTS as E, RESULT_TAG } from './constants'
import {
  type BoardErrorDto,
  BoardErrorDtoSchema,
  BoardScopeSchema,
  BoardSnapshotSchema,
  BranchCheckSchema,
  ColumnDescriptionSchema,
  ColumnDtoSchema,
  ColumnIdSchema,
  ColumnPositionSchema,
  ColumnRefSchema,
  CreateTaskInputSchema,
  IdSchema,
  LabelColorSchema,
  LabelDtoSchema,
  LabelIdSchema,
  NameSchema,
  StartInNewWorktreeInputSchema,
  StartInWorktreeInputSchema,
  StartPrepSchema,
  StartTaskResultSchema,
  TaskDtoSchema,
  TaskIdSchema,
  TaskPositionSchema,
  TaskRefSchema,
  UpdateTaskPatchSchema,
} from './dto'

/** The IPC form of `Result<T, BoardErrorDto>`: expected failures travel as values (codes survive IPC). */
export function boardResultSchema<T>(value: z.ZodType<T>): z.ZodType<Result<T, BoardErrorDto>> {
  return z.discriminatedUnion(RESULT_TAG, [
    z.object({ ok: z.literal(true), value }),
    z.object({ ok: z.literal(false), error: BoardErrorDtoSchema }),
  ]) as z.ZodType<Result<T, BoardErrorDto>>
}

const call = <I, O>(channel: string, input: z.ZodType<I>, output: z.ZodType<O>) =>
  defineIpc({ channel, input, output: boardResultSchema(output) })
const none = z.void()
const empty = z.object({})
const projectRef = z.object({ projectId: IdSchema })
const taskRef = z.object({ id: TaskIdSchema })
const sessionLink = z.object({ taskId: TaskIdSchema, sessionId: IdSchema })
const scopeRef = z.object({ scope: BoardScopeSchema })

export const ProjectOptionSchema = z.object({ id: IdSchema, name: z.string() })
export type ProjectOption = z.infer<typeof ProjectOptionSchema>

/** One contract per `BoardService` method plus a few renderer helpers; every answer is `Result<T, BoardErrorDto>`. */
export const boardIpc = {
  getSnapshot: call(C.getSnapshot, scopeRef, BoardSnapshotSchema),
  getTask: call(C.getTask, z.object({ ref: TaskRefSchema }), TaskDtoSchema.nullable()),
  createTask: call(C.createTask, CreateTaskInputSchema, TaskDtoSchema),
  updateTask: call(C.updateTask, taskRef.extend({ patch: UpdateTaskPatchSchema }), TaskDtoSchema),
  deleteTask: call(C.deleteTask, taskRef, none),
  moveTask: call(
    C.moveTask,
    taskRef.extend({ column: ColumnRefSchema, position: TaskPositionSchema.optional() }),
    TaskDtoSchema,
  ),
  unlinkSession: call(C.unlinkSession, sessionLink, none),
  createColumn: call(
    C.createColumn,
    projectRef.extend({ name: NameSchema, position: ColumnPositionSchema.optional() }),
    ColumnDtoSchema,
  ),
  renameColumn: call(C.renameColumn, z.object({ columnId: ColumnIdSchema, name: NameSchema }), ColumnDtoSchema),
  setColumnDescription: call(
    C.setColumnDescription,
    z.object({ columnId: ColumnIdSchema, description: ColumnDescriptionSchema }),
    ColumnDtoSchema,
  ),
  moveColumn: call(
    C.moveColumn,
    z.object({ columnId: ColumnIdSchema, position: ColumnPositionSchema }),
    ColumnDtoSchema,
  ),
  deleteColumn: call(
    C.deleteColumn,
    z.object({ columnId: ColumnIdSchema, moveTasksTo: ColumnIdSchema.optional() }),
    none,
  ),
  createLabel: call(
    C.createLabel,
    projectRef.extend({ name: NameSchema, color: LabelColorSchema.optional() }),
    LabelDtoSchema,
  ),
  updateLabel: call(
    C.updateLabel,
    z.object({
      labelId: LabelIdSchema,
      patch: z.object({ name: NameSchema.optional(), color: LabelColorSchema.optional() }),
    }),
    LabelDtoSchema,
  ),
  deleteLabel: call(C.deleteLabel, z.object({ labelId: LabelIdSchema }), none),
  prepareStart: call(C.prepareStart, z.object({ taskId: TaskIdSchema }), StartPrepSchema),
  checkBranch: call(C.checkBranch, projectRef.extend({ branch: z.string() }), BranchCheckSchema),
  startInNewWorktree: call(C.startInNewWorktree, StartInNewWorktreeInputSchema, StartTaskResultSchema),
  startInWorktree: call(C.startInWorktree, StartInWorktreeInputSchema, StartTaskResultSchema),
  resolveDefaultScope: call(C.resolveDefaultScope, empty, BoardScopeSchema),
  listProjects: call(C.listProjects, empty, z.array(ProjectOptionSchema)),
  openCount: call(C.openCount, scopeRef, z.object({ open: z.number().int().nonnegative() })),
} as const

export const BoardChangedEventSchema = z.object({ projectIds: z.array(IdSchema) })
export type BoardChangedEvent = z.infer<typeof BoardChangedEventSchema>
export const SessionStatusChangedEventSchema = z.object({
  sessionId: IdSchema,
  status: AgentStatusSchema,
  turnCompleted: z.boolean(),
})
export type SessionStatusChangedEvent = z.infer<typeof SessionStatusChangedEventSchema>

/** Main → renderer push events (`ctx.ipc.publish`). */
export const boardIpcEvents = {
  changed: defineIpcEvent({ channel: E.changed, payload: BoardChangedEventSchema }),
  sessionStatusChanged: defineIpcEvent({ channel: E.sessionStatusChanged, payload: SessionStatusChangedEventSchema }),
} as const
