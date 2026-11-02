import { describe, expect, it } from 'vitest'
import { checkClaudeSupport } from '../../src/main/chat/support'
import { profileFor } from './support'

const found = new Map([
  ['/usr/local/bin/claude', '/usr/local/bin/claude'],
  ['claude', '/usr/local/bin/claude'],
])
const resolve = async (cmd: string) => found.get(cmd) ?? null

describe('checkClaudeSupport', () => {
  it.each([
    ['/usr/local/bin/claude', { ok: true }],
    ['claude', { ok: true }],
    ['missing-claude', { ok: false, reasonKey: 'chat:unsupported.commandNotFound', detail: 'missing-claude' }],
  ])('support for %s', async (command, expected) => {
    expect(await checkClaudeSupport(profileFor(command), resolve)).toEqual(expected)
  })
})
