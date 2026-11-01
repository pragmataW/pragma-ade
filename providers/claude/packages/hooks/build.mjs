// Bundles the Claude Code status hook into dist/pragma-hook.mjs (self-contained, no runtime dependencies).
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleHook } from '@pragma/module-agent-status/bundle-hook'

const SELF = fileURLToPath(import.meta.url)
const DIR = dirname(SELF)
export const HOOK_OUTFILE = join(DIR, 'dist', 'pragma-hook.mjs')

export const buildClaudeHook = () => bundleHook({ entry: join(DIR, 'src', 'pragma-hook.ts'), outfile: HOOK_OUTFILE })

if (process.argv[1] && resolve(process.argv[1]) === SELF) await buildClaudeHook()
