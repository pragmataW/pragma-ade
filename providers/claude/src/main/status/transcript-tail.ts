import { open, stat } from 'node:fs/promises'
import { CONTENT_BLOCK, TRANSCRIPT_ENTRY as E, NEWLINE, NEWLINE_BYTE, CLAUDE_TRANSCRIPT as T } from './constants'

/** The two file operations the tail needs (injected in tests). */
export interface TranscriptFs {
  /** The file size in bytes, or null when it does not exist (yet). */
  size(path: string): Promise<number | null>
  /** Up to `length` bytes from `start`. */
  read(path: string, start: number, length: number): Promise<Buffer>
}

export const nodeTranscriptFs: TranscriptFs = {
  async size(path) {
    try {
      return (await stat(path)).size
    } catch {
      return null
    }
  },
  async read(path, start, length) {
    const handle = await open(path, 'r')
    try {
      const buf = Buffer.alloc(length)
      const { bytesRead } = await handle.read(buf, 0, length, start)
      return buf.subarray(0, bytesRead)
    } finally {
      await handle.close()
    }
  },
}

/** What appeared in the transcript since the previous scan. */
export interface TailScan {
  /** A user-interrupt marker of the main conversation. */
  interrupted: boolean
  /** Assistant text or a tool call of the main conversation (Claude keeps the turn's prompt then). */
  progressed: boolean
}

type Entry = Record<string, unknown>
const NOTHING: TailScan = { interrupted: false, progressed: false }

const asEntry = (v: unknown): Entry | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Entry) : null)
const blocksOf = (content: unknown): Entry[] =>
  Array.isArray(content) ? content.map(asEntry).filter((b): b is Entry => b !== null) : []
const contentOf = (entry: Entry): unknown => asEntry(entry.message)?.content
const textOf = (block: Entry): string | null =>
  block.type === CONTENT_BLOCK.text && typeof block.text === 'string' ? block.text : null
const isMain = (entry: Entry, type: string): boolean => entry.type === type && entry.isSidechain !== true

/** `[Request interrupted by user]` / `… for tool use]`, as string content or a text block of a user entry. */
export function isInterruptMarker(entry: Entry): boolean {
  if (!isMain(entry, E.user)) return false
  const content = contentOf(entry)
  if (typeof content === 'string') return content.startsWith(T.interruptPrefix)
  return blocksOf(content).some((b) => textOf(b)?.startsWith(T.interruptPrefix) === true)
}

/** An assistant entry with non-blank text or a tool call (Claude's own "the model answered" test). */
export function isAssistantProgress(entry: Entry): boolean {
  if (!isMain(entry, E.assistant)) return false
  return blocksOf(contentOf(entry)).some((b) => b.type === CONTENT_BLOCK.toolUse || Boolean(textOf(b)?.trim()))
}

function parseEntry(line: string): Entry | null {
  try {
    return asEntry(JSON.parse(line))
  } catch {
    return null
  }
}

/** One JSONL line; only lines that can matter are parsed. */
export function scanLine(line: string): TailScan {
  const marker = line.includes(T.interruptPrefix)
  if (!marker && !line.includes(T.assistantNeedle)) return NOTHING
  const entry = parseEntry(line)
  if (!entry) return NOTHING
  return { interrupted: marker && isInterruptMarker(entry), progressed: isAssistantProgress(entry) }
}

/**
 * Reads what a transcript gains after a starting offset, a whole line at a time (a partial last line waits for the
 * next scan). Reads at most `maxScanBytes` per scan, the newest ones; skipped bytes count as progress.
 */
export class TranscriptTail {
  readonly path: string
  readonly #fs: TranscriptFs
  readonly #maxBytes: number
  #offset: number
  /** The offset points into a line whose start was skipped. */
  #midLine = false

  private constructor(fs: TranscriptFs, path: string, offset: number, maxBytes: number) {
    this.#fs = fs
    this.path = path
    this.#offset = offset
    this.#maxBytes = maxBytes
  }

  /** A tail that starts at the transcript's current end (0 when it does not exist yet). */
  static async at(fs: TranscriptFs, path: string, maxBytes: number = T.maxScanBytes): Promise<TranscriptTail> {
    return new TranscriptTail(fs, path, (await fs.size(path)) ?? 0, maxBytes)
  }

  async scan(): Promise<TailScan> {
    const size = (await this.#fs.size(this.path)) ?? 0
    if (size < this.#offset) this.#offset = size
    if (size === this.#offset) return NOTHING
    const skipped = size - this.#offset > this.#maxBytes
    const start = skipped ? size - this.#maxBytes : this.#offset
    const buf = await this.#fs.read(this.path, start, size - start)
    const midLine = this.#midLine || skipped
    const end = buf.lastIndexOf(NEWLINE_BYTE)
    if (end < 0) {
      this.#offset = start
      this.#midLine = midLine
      return { interrupted: false, progressed: skipped }
    }
    this.#offset = start + end + 1
    this.#midLine = false
    const lines = buf.subarray(0, end).toString('utf8').split(NEWLINE)
    if (midLine) lines.shift()
    return lines
      .map(scanLine)
      .reduce((a, b) => ({ interrupted: a.interrupted || b.interrupted, progressed: a.progressed || b.progressed }), {
        interrupted: false,
        progressed: skipped,
      })
  }
}
