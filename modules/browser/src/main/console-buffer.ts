import { RingBuffer, z } from '@pragma/sdk'
import { CONSOLE_MESSAGE_MAX, LEGACY_CONSOLE_LEVELS } from '../constants'

export const ConsoleEntrySchema = z.object({
  level: z.enum(LEGACY_CONSOLE_LEVELS),
  message: z.string(),
  source: z.string(),
  line: z.number(),
  timestamp: z.number(),
})
export type ConsoleEntry = z.infer<typeof ConsoleEntrySchema>
export type ConsoleLevel = ConsoleEntry['level']
export const ERROR_LEVEL: ConsoleLevel = 'error'

export const createConsoleBuffer = (capacity: number): RingBuffer<ConsoleEntry> => new RingBuffer(capacity)

/** A buffer of the new capacity, seeded with the newest entries of `old`. */
export function resizeConsoleBuffer(old: RingBuffer<ConsoleEntry>, capacity: number): RingBuffer<ConsoleEntry> {
  const next = createConsoleBuffer(capacity)
  for (const entry of old.toArray().slice(-capacity)) next.push(entry)
  return next
}

/** Electron ≥ 35 passes one `details` object; older versions `(event, level:number, message, line, sourceId)`. */
const DetailsSchema = z.object({
  level: z.enum(LEGACY_CONSOLE_LEVELS),
  message: z.string(),
  lineNumber: z.number().optional(),
  sourceId: z.string().optional(),
})
const LegacySchema = z.tuple([z.unknown(), z.number().int(), z.string(), z.number(), z.string()])

export function normalizeConsoleEvent(args: unknown[], now: number): ConsoleEntry | null {
  const details = DetailsSchema.safeParse(args[0])
  if (details.success) {
    const d = details.data
    return { level: d.level, message: d.message, source: d.sourceId ?? '', line: d.lineNumber ?? 0, timestamp: now }
  }
  const legacy = LegacySchema.safeParse(args)
  if (!legacy.success) return null
  const [, levelIndex, message, line, source] = legacy.data
  const level = LEGACY_CONSOLE_LEVELS[levelIndex]
  return level ? { level, message, source, line, timestamp: now } : null
}

/** `[error] <message clipped> (<source>:<line>)`. */
export function formatConsoleEntry(e: ConsoleEntry): string {
  const message = e.message.length > CONSOLE_MESSAGE_MAX ? e.message.slice(0, CONSOLE_MESSAGE_MAX) : e.message
  return `[${e.level}] ${message} (${e.source}:${e.line})`
}
