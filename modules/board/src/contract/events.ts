import { defineCommand, defineEvent, z } from '@pragma/sdk'
import { BOARD_CHANGED_EVENT, BOARD_OPEN_COMMAND_ID, CHANGE_KINDS } from './constants'
import { IdSchema, TaskIdSchema } from './dto'

export const BoardChangedPayloadSchema = z.object({
  projectId: IdSchema,
  taskIds: z.array(TaskIdSchema),
  kind: z.enum(CHANGE_KINDS),
})
export type BoardChangedPayload = z.infer<typeof BoardChangedPayloadSchema>
/** Main bus; emitted once per committed mutation. */
export const boardChanged = defineEvent<BoardChangedPayload>(BOARD_CHANGED_EVENT)

export const BoardOpenArgsSchema = z.object({ projectId: IdSchema.optional() })
export type BoardOpenArgs = z.infer<typeof BoardOpenArgsSchema>
/** `board.open { projectId? }` (renderer). */
export const boardOpenCommand = defineCommand({ id: BOARD_OPEN_COMMAND_ID, args: BoardOpenArgsSchema.optional() })

/** Props of the `board.card.badges` slot (§10.3). */
export const BoardCardBadgesPropsSchema = z.object({ taskId: TaskIdSchema, sessionIds: z.array(IdSchema) })
export type BoardCardBadgesProps = z.infer<typeof BoardCardBadgesPropsSchema>
