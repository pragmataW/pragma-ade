import { tmpdir } from 'node:os'
import type { SpawnSpec } from '../../packages/pty-daemon/src/protocol'

const DEFAULT_SCROLLBACK = 1000

/** A valid spawn spec running `/bin/sh -c <script>` (or the given overrides) in the temp dir. */
export function spec(overrides: Partial<SpawnSpec> = {}): SpawnSpec {
  return {
    cwd: tmpdir(),
    command: '/bin/sh',
    args: ['-c', 'exit 0'],
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: tmpdir() },
    scrollback: DEFAULT_SCROLLBACK,
    tags: {},
    cols: 80,
    rows: 24,
    ...overrides,
  }
}

/** Shorthand: a spec running a shell script. */
export const shSpec = (script: string, overrides: Partial<SpawnSpec> = {}): SpawnSpec =>
  spec({ args: ['-c', script], ...overrides })
