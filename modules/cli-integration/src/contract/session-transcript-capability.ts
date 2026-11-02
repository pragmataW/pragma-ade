import { z } from '@pragma/sdk'

/** Where a provider keeps one session's full transcript on this machine. */
export const sessionTranscriptLocationSchema = z.object({
  /** The transcript file, or the store that holds it (e.g. a database). */
  path: z.string().min(1),
  /** Short human description of the format, fixed English (it is shown to agents). */
  format: z.string().min(1),
  /** Directory the session ran in, when the store records it. */
  cwd: z.string().nullable(),
  /** Shell command that prints a readable transcript, when `path` is not readable as-is. */
  readCommand: z.string().nullable(),
  /** Related files (e.g. subagent transcripts). */
  extraPaths: z.array(z.string()),
})
export type SessionTranscriptLocation = z.infer<typeof sessionTranscriptLocationSchema>

export interface SessionTranscriptQuery {
  /** The provider's own session id (never a Pragma session id). */
  sessionId: string
  /** Directory the session ran in, when known (checked first). */
  cwd?: string
  home: string
  env: Readonly<Record<string, string | undefined>>
}

/** Provider capability `sessionTranscript`: find a session's local transcript; `null` when it is not stored here. */
export interface SessionTranscriptCapability {
  locateTranscript(q: SessionTranscriptQuery): Promise<SessionTranscriptLocation | null>
}

declare module '@pragma/sdk' {
  interface CapabilityMap {
    sessionTranscript: SessionTranscriptCapability
  }
}
