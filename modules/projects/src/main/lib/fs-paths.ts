import { existsSync, realpathSync } from 'node:fs'
import { resolve } from 'node:path'

/** Every stored or compared path goes through here (macOS `/var` → `/private/var`, no trailing slash). */
export const canonicalPath = (p: string): string => (existsSync(p) ? realpathSync.native(p) : resolve(p))
