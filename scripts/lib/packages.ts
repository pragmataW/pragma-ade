import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export const PACKAGE_JSON = 'package.json'

/** The nearest directory at or above `file` (but not above `repoRoot`) that has a package.json. */
export function packageRootOf(file: string, repoRoot: string): string {
  const root = resolve(repoRoot)
  let dir = dirname(resolve(file))
  while (dir.startsWith(root) && dir !== root) {
    if (existsSync(join(dir, PACKAGE_JSON))) return dir
    dir = dirname(dir)
  }
  return root
}
