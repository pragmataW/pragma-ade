export const PROVIDER_ID = 'claude'
export const DEFAULT_COMMAND = 'claude'
/** A transcript's first events carry `cwd`; never read more than this to find it. */
const KIB = 1024
const TRANSCRIPT_HEAD_KIB = 64
export const TRANSCRIPT_HEAD_BYTES = TRANSCRIPT_HEAD_KIB * KIB
