// Claude Code command hook: `<runner> <EventName>`, hook JSON on stdin. Forwards a few fields to the Pragma bridge.
// It never prints (stdout of some hooks is injected into Claude's context) and always exits 0.
import { isAbsolute } from 'node:path'
import { readHookEnv, sendHookEvent, truncateField } from '@pragma/module-agent-status/client'
import {
  ARGV_EVENT_INDEX,
  CLAUDE_PROVIDER_ID,
  EVENT_NAME_FIELD,
  PICKED_FIELDS,
  STDIN_MAX_BYTES,
  STDIN_TIMEOUT_MS,
  TRANSCRIPT_EXTENSION,
  TRANSCRIPT_PATH_FIELD,
  TRANSCRIPT_PATH_MAX_CHARS,
} from './constants'

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    const done = (): void => {
      clearTimeout(timer)
      process.stdin.removeAllListeners()
      process.stdin.pause()
      resolve(Buffer.concat(chunks).toString())
    }
    const timer = setTimeout(done, STDIN_TIMEOUT_MS)
    process.stdin.on('data', (c: Buffer) => {
      size += c.length
      if (size > STDIN_MAX_BYTES) done()
      else chunks.push(c)
    })
    process.stdin.on('end', done)
    process.stdin.on('error', done)
  })
}

function parseObject(text: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(text)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** The transcript path when it is an absolute `.jsonl` path that fits whole; otherwise undefined. */
export function transcriptPathOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > TRANSCRIPT_PATH_MAX_CHARS) return undefined
  return isAbsolute(value) && value.endsWith(TRANSCRIPT_EXTENSION) ? value : undefined
}

/** Only `PICKED_FIELDS`, each truncated, plus a valid transcript path; the event name falls back to argv. */
export function pickFields(input: Record<string, unknown>, argvEvent: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of PICKED_FIELDS) {
    const value = truncateField(input[key])
    if (value !== undefined) out[key] = value
  }
  const transcript = transcriptPathOf(input[TRANSCRIPT_PATH_FIELD])
  if (transcript !== undefined) out[TRANSCRIPT_PATH_FIELD] = transcript
  const fallback = truncateField(argvEvent)
  if (out[EVENT_NAME_FIELD] === undefined && fallback !== undefined) out[EVENT_NAME_FIELD] = fallback
  return out
}

async function main(): Promise<void> {
  const env = readHookEnv(process.env)
  if (!env) return
  const input = parseObject(await readStdin())
  await sendHookEvent(env, CLAUDE_PROVIDER_ID, pickFields(input, process.argv[ARGV_EVENT_INDEX]))
}

main()
  .catch(() => undefined)
  .finally(() => process.exit(0))
