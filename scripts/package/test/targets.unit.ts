import { describe, expect, it } from 'vitest'
import { parseTargets, TARGET_IDS, TARGETS } from '../lib/targets.ts'

describe('parseTargets', () => {
  it.each([
    [['mac'], ['darwin-arm64', 'darwin-x64']],
    [
      ['win', 'linux', 'win'],
      ['linux-x64', 'win32-x64'],
    ],
    [['all'], [...TARGET_IDS]],
    [
      ['darwin-x64', 'mac'],
      ['darwin-arm64', 'darwin-x64'],
    ],
  ])('%j → %j', (args, ids) => expect(parseTargets(args)).toEqual(ids))
  it('rejects unknown targets', () => expect(() => parseTargets(['solaris'])).toThrow(/Unknown target "solaris"/))
  it('linux installs glibc packages', () =>
    expect(TARGETS['linux-x64'].npm).toEqual({ os: 'linux', cpu: 'x64', libc: 'glibc' }))
})
