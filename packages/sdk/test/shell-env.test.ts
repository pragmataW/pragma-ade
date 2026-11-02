import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { resolveShellEnv } from '../src/runtime/main/shell-env'

const NUL = '\0'

test('shell env parses env -0 output and caches', async () => {
  const run = vi.fn(async () => ['PATH=/a:/b', 'MULTI=line1\nline2', 'EMPTY=', ''].join(NUL))
  const env = await resolveShellEnv({ shell: '/bin/zsh', platform: 'darwin', run })
  expect(env).toMatchObject({ PATH: '/a:/b', MULTI: 'line1\nline2', EMPTY: '' })
  expect(run).toHaveBeenCalledWith('/bin/zsh', ['-ilc', 'env -0'], expect.objectContaining({ timeoutMs: 5000 }))
  await resolveShellEnv({ shell: '/bin/zsh', platform: 'darwin', run })
  expect(run).toHaveBeenCalledOnce()
})
test('shell env falls back on timeout', async () => {
  const run = vi.fn(() => Promise.reject(new Error('timeout')))
  const env = await resolveShellEnv({ shell: '/bin/bash', platform: 'linux', run, timeoutMs: 1 })
  expect(env.PATH).toBe(process.env.PATH)
})
test('shell env on win32 returns process.env', async () => {
  const run = vi.fn(async () => '')
  expect((await resolveShellEnv({ platform: 'win32', run })).PATH).toBe(process.env.PATH)
  expect(run).not.toHaveBeenCalled()
})

// Real runner against fake shells: `.bashrc` that starts an interactive `zsh` (reads stdin), and a shell that
// ignores SIGTERM while a child keeps stdout open (interactive bash).
const fakeShell = (body: string): string => {
  const file = join(mkdtempSync(join(tmpdir(), 'pragma-shell-env-')), 'sh')
  writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 })
  return file
}
test.skipIf(process.platform === 'win32')('shell env gets EOF on stdin so rc-file subshells exit', async () => {
  const env = await resolveShellEnv({ shell: fakeShell("cat >/dev/null\nprintf 'FAKE=1\\0'"), platform: 'linux' })
  expect(env.FAKE).toBe('1')
})
test.skipIf(process.platform === 'win32')(
  'shell env times out a shell that ignores SIGTERM',
  async () => {
    const env = await resolveShellEnv({ shell: fakeShell("trap '' TERM\nsleep 30"), platform: 'linux', timeoutMs: 200 })
    expect(env.PATH).toBe(process.env.PATH)
  },
  3000,
)
