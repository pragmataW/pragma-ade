import { open, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { SessionTranscriptCapability, SessionTranscriptQuery } from '@pragma/module-cli-integration/contract'
import { defineCapability } from '@pragma/sdk'
import { TRANSCRIPT_HEAD_BYTES as HEAD_BYTES, PROVIDER_ID } from '../constants'
import { CLAUDE_HOME_ENV, CLAUDE_TRANSCRIPT_EXT, claudeConfigDir, findClaudeTranscript } from './resume/conversation'

const FORMAT = 'Claude Code JSONL (one JSON event per line)'
const SUBAGENTS_DIR = 'subagents'
const UTF8 = 'utf8'
const NEWLINE = '\n'

/** `cwd` of the first event that records one (read from the head of the file only). */
async function transcriptCwd(path: string): Promise<string | null> {
  const file = await open(path, 'r').catch(() => null)
  if (!file) return null
  try {
    const buf = Buffer.alloc(HEAD_BYTES)
    const { bytesRead } = await file.read(buf, 0, HEAD_BYTES, 0)
    for (const line of buf.toString(UTF8, 0, bytesRead).split(NEWLINE)) {
      const cwd = parseCwd(line)
      if (cwd) return cwd
    }
    return null
  } finally {
    await file.close()
  }
}

function parseCwd(line: string): string | null {
  try {
    const event: unknown = JSON.parse(line)
    const cwd = typeof event === 'object' && event !== null ? (event as { cwd?: unknown }).cwd : undefined
    return typeof cwd === 'string' && cwd ? cwd : null
  } catch {
    return null
  }
}

/** `<project dir>/<id>/subagents/*.jsonl` (Task tool transcripts), sorted. */
async function subagentTranscripts(transcript: string): Promise<string[]> {
  const dir = join(transcript.slice(0, -CLAUDE_TRANSCRIPT_EXT.length), SUBAGENTS_DIR)
  const names = await readdir(dir).catch(() => [] as string[])
  return names
    .filter((n) => n.endsWith(CLAUDE_TRANSCRIPT_EXT))
    .sort()
    .map((n) => join(dir, n))
}

export async function locateClaudeTranscript(q: SessionTranscriptQuery) {
  const configDir = claudeConfigDir({ ...q.env, [CLAUDE_HOME_ENV]: q.home })
  const path = await findClaudeTranscript(configDir, q.sessionId, q.cwd)
  if (!path) return null
  const [cwd, extraPaths] = await Promise.all([transcriptCwd(path), subagentTranscripts(path)])
  return { path, format: FORMAT, cwd, readCommand: null, extraPaths }
}

/** Claude Code keeps every session as `${CLAUDE_CONFIG_DIR:-~/.claude}/projects/<encoded cwd>/<id>.jsonl`. */
export const claudeSessionTranscriptCapability: SessionTranscriptCapability = {
  locateTranscript: locateClaudeTranscript,
}

export default defineCapability(PROVIDER_ID, 'sessionTranscript', claudeSessionTranscriptCapability)
