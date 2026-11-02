import { z } from '@pragma/sdk'

declare module '@pragma/sdk' {
  interface CapabilityMap {
    resume: ResumeCapability
  }
}

export const resumeInputSchema = z.object({ externalSessionId: z.string(), serverUrl: z.string().url().optional() })
export type ResumeInput = z.infer<typeof resumeInputSchema>

export const resumeSpecSchema = z.object({ args: z.array(z.string()), env: z.record(z.string(), z.string()) })
export type ResumeSpec = z.infer<typeof resumeSpecSchema>

/** §10.3: how a provider resumes an external session in a terminal (args/env appended by 11c's decorator). */
export interface ResumeCapability {
  terminalResumeArgs(input: ResumeInput): ResumeSpec
  /** The chat adapter can resume a session the terminal started. */
  canResumeInChat: boolean
}

/** An id that is safe as a single argv value: no leading `-`, no whitespace, at most 200 chars. */
export const SAFE_EXTERNAL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/
export const isSafeExternalSessionId = (id: string): boolean => SAFE_EXTERNAL_ID_RE.test(id)
export const INVALID_EXTERNAL_ID_MESSAGE = 'invalid external session id'
