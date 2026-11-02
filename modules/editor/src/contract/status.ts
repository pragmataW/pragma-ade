import { z } from '@pragma/sdk'
import { EDITOR_STATE } from './constants'

const version = z.string()

/** Install/server state machine shown by the Files tab. */
export const EditorStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal(EDITOR_STATE.notInstalled), version, sizeBytes: z.number() }),
  z.object({ state: z.literal(EDITOR_STATE.downloading), version, received: z.number(), total: z.number() }),
  z.object({ state: z.literal(EDITOR_STATE.verifying), version }),
  z.object({ state: z.literal(EDITOR_STATE.extracting), version }),
  z.object({ state: z.literal(EDITOR_STATE.starting), version }),
  z.object({ state: z.literal(EDITOR_STATE.ready), version, port: z.number() }),
  z.object({
    state: z.literal(EDITOR_STATE.error),
    version,
    errorKey: z.string(),
    detail: z.string().optional(),
    retryable: z.boolean(),
  }),
])
export type EditorStatus = z.infer<typeof EditorStatusSchema>
