import type { ChatSupport } from '@pragma/module-chat/contract'
import { describe, expect, it } from 'vitest'
import { REASON } from '../src/main/chat/constants'
import { checkOpencodeSupport } from '../src/main/chat/support'
import { BIN, FAKE_ENV, fakeCapCtx } from '../testing/fake-opencode-server/harness'

const node = process.execPath
const profile = (command: string, args: string[] = [], env: Record<string, string> = {}) => ({ command, args, env })

describe('checkOpencodeSupport', () => {
  it.each<[string, ReturnType<typeof profile>, ChatSupport]>([
    ['empty command', profile('  '), { ok: false, reasonKey: REASON.emptyCommand }],
    [
      'unresolvable command',
      profile('opencode-nope'),
      { ok: false, reasonKey: REASON.commandNotFound, detail: 'opencode-nope' },
    ],
    [
      'fake legacy-1x',
      profile(node, [BIN], { [FAKE_ENV.mode]: 'legacy-1x' }),
      { ok: false, reasonKey: REASON.upgradeRequired, detail: '1.1.36' },
    ],
    ['fake normal', profile(node, [BIN]), { ok: true }],
    ['fake 3.x', profile(node, [BIN], { [FAKE_ENV.mode]: 'version:3.0.1' }), { ok: true }],
    ['wrapper that ignores --version', profile(node, ['-e', 'console.log("hello")']), { ok: true }],
    ['wrapper that fails', profile(node, ['-e', 'process.exit(2)']), { ok: true }],
  ])('%s', async (_, p, expected) => {
    expect(await checkOpencodeSupport(p, fakeCapCtx())).toEqual(expected)
  })
})
