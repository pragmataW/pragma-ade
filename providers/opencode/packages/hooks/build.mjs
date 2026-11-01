// Bundles the OpenCode 2.x status plugin into dist/plugin/index.js (a plugin DIRECTORY: 2.x skips file paths).
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleHook } from '@pragma/module-agent-status/bundle-hook'

const SELF = fileURLToPath(import.meta.url)
const DIR = dirname(SELF)
export const PLUGIN_OUTFILE = join(DIR, 'dist', 'plugin', 'index.js')

export const buildOpencodePlugin = () => bundleHook({ entry: join(DIR, 'src', 'plugin.ts'), outfile: PLUGIN_OUTFILE })

if (process.argv[1] && resolve(process.argv[1]) === SELF) await buildOpencodePlugin()
