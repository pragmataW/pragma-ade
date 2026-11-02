import { parseSemver } from '@pragma/module-agents/contract'
import { READY_FORMAT, type READY_FORMATS, READY_RE, STDIO_READY_RE } from '../constants'

export type ReadyFormat = (typeof READY_FORMATS)[number]

/** The server URL from `serve` output: the `--stdio` JSON line, 2.x `server listening on`, or 1.x's prefixed line. */
export function parseReadyLine(text: string): { url: string; format: ReadyFormat } | null {
  const stdio = STDIO_READY_RE.exec(text)?.groups?.url
  if (stdio) return { url: stdio, format: READY_FORMAT.stdio }
  const m = READY_RE.exec(text)
  const url = m?.groups?.url
  if (!url) return null
  return { url, format: m.groups?.legacy ? READY_FORMAT.legacy : READY_FORMAT.listening }
}

/** `2.2.5`, `v2.2.5` or `opencode v2.2.5` (03's `parseSemver`). */
export function parseVersion(text: string): { major: number; minor: number; patch: number } | null {
  const v = parseSemver(text)
  if (!v) return null
  const [major, minor, patch] = v
  return { major, minor, patch }
}
