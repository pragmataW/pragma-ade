import { createServiceToken, defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { IPC, SERVICE_ID } from '../constants'
import {
  type EntryDetail,
  EntryDetailSchema,
  type EntrySummary,
  EntrySummarySchema,
  type FileContent,
  FileContentSchema,
  FileRefSchema,
  IdSchema,
  ListInputSchema,
  type RecordInput,
  RestoreInputSchema,
  type RestoreResult,
  RestoreResultSchema,
} from './schemas'

const none = z.void()

/** Renderer ↔ main channels (`local-history.*`); `changed` is main → renderer after any write. */
export const LocalHistoryIpc = {
  list: defineIpc({ channel: IPC.list, input: ListInputSchema, output: z.array(EntrySummarySchema) }),
  detail: defineIpc({ channel: IPC.detail, input: IdSchema, output: EntryDetailSchema.nullable() }),
  fileContent: defineIpc({ channel: IPC.fileContent, input: FileRefSchema, output: FileContentSchema.nullable() }),
  restore: defineIpc({ channel: IPC.restore, input: RestoreInputSchema, output: RestoreResultSchema }),
  remove: defineIpc({ channel: IPC.remove, input: IdSchema, output: none }),
  clear: defineIpc({ channel: IPC.clear, input: none, output: none }),
  changed: defineIpcEvent({ channel: IPC.changed, payload: none }),
} as const

/** Main-side store; other modules may record before their own destructive work (optional dependency). */
export interface LocalHistoryService {
  record(input: RecordInput): Promise<EntrySummary | null>
  /** Newest first; only `worktreeId`'s entries when given. */
  list(worktreeId?: string): EntrySummary[]
  detail(id: number): EntryDetail | null
  fileContent(id: number, path: string): FileContent | null
  restore(id: number, paths?: string[]): Promise<RestoreResult>
  remove(id: number): void
  clear(): void
  /** Drops expired entries, then the oldest until the store fits its size cap; returns how many went. */
  prune(): number
}
export const LocalHistoryServiceToken = createServiceToken<LocalHistoryService>(SERVICE_ID)

export * from './schemas'
export { LOCAL_HISTORY_TESTIDS } from './testids'
