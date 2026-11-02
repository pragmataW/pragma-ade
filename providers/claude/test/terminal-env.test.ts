import { fakeCapabilityContext } from '@pragma/module-agents/testing'
import { expect, it } from 'vitest'
import { CLAUDE_INHERITED_ENV } from '../src/constants'
import { buildClaudeChildEnv } from '../src/main/chat/env'
import terminalEnv from '../src/main/terminalEnv.capability'

const PARENT_STAMPS = {
  CLAUDECODE: '1',
  CLAUDE_CODE_ENTRYPOINT: 'claude-desktop',
  CLAUDE_CODE_CHILD_SESSION: '1',
  CLAUDE_CODE_SESSION_ID: 'parent',
}

it('terminalEnv lists the parent Claude session stamps a nested `claude` must not inherit', () => {
  expect(terminalEnv.key).toBe('terminalEnv')
  const cap = terminalEnv.create(fakeCapabilityContext()) as { inheritedEnvKeys: readonly string[] }
  expect(cap.inheritedEnvKeys).toEqual(CLAUDE_INHERITED_ENV)
  expect(cap.inheritedEnvKeys).toEqual(expect.arrayContaining(Object.keys(PARENT_STAMPS)))
  expect(cap.inheritedEnvKeys.some((k) => k.startsWith('PRAGMA_'))).toBe(false)
})

it('the chat child env strips the same list', () => {
  expect(buildClaudeChildEnv({ ...PARENT_STAMPS, PRAGMA_SESSION_ID: 's1' })).toEqual({ PRAGMA_SESSION_ID: 's1' })
})
