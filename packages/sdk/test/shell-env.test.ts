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
