/** Regenerates build/icon.png from build/icon.svg: `node scripts/package/make-icon.ts`. */
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { DESKTOP_DIR, ELECTRON_PACKAGE, ICON_PNG, ICON_SVG, PACKAGE_JSON, PARENT_SEGMENT } from './constants.ts'
import { renderIcon } from './lib/icon.ts'

const repo = resolve(import.meta.dirname, PARENT_SEGMENT, PARENT_SEGMENT)
const electron = createRequire(join(repo, DESKTOP_DIR, PACKAGE_JSON))(ELECTRON_PACKAGE) as string
await renderIcon(electron, join(repo, ICON_SVG), join(repo, ICON_PNG))
console.log(`wrote ${ICON_PNG}`)
