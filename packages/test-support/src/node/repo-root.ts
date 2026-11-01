import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { WORKSPACE_MARKER } from './constants'

export class RepoRootNotFoundError extends Error {}

/** Walks up from `from` (default: this file) to the directory holding pnpm-workspace.yaml. */
export function findRepoRoot(from: string = import.meta.dirname): string {
  let dir = resolve(from)
  for (;;) {
    if (existsSync(join(dir, WORKSPACE_MARKER))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new RepoRootNotFoundError(`no ${WORKSPACE_MARKER} above ${from}`)
    dir = parent
  }
}
