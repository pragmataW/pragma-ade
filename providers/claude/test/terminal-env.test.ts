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

/** What a Claude Code host (desktop app, SDK) sets for its own session: runtime plumbing, never user configuration. */
const HOST_PLUMBING = {
  CLAUDE_CODE_HOST_SESSION_ID: 'local_parent',
  CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/cc-socks/1.sock',
  CLAUDE_CODE_MESSAGING_TOKEN: 'secret',
  CLAUDE_CODE_SDK_HAS_HOST_AUTH_REFRESH: '1',
  CLAUDE_CODE_SESSION_ATTENDED: '1',
  CLAUDE_CODE_EXECPATH: '/parent/claude',
  CLAUDE_PID: '123',
}

it("a parent host session's plumbing (socket, token, host auth refresh) is dropped too; user settings stay", () => {
  const env = { ...PARENT_STAMPS, ...HOST_PLUMBING, CLAUDE_CODE_USE_BEDROCK: '1', CLAUDE_CONFIG_DIR: '/c' }
  expect(buildClaudeChildEnv(env)).toEqual({ CLAUDE_CODE_USE_BEDROCK: '1', CLAUDE_CONFIG_DIR: '/c' })
  expect(CLAUDE_INHERITED_ENV).toEqual(expect.arrayContaining(Object.keys(HOST_PLUMBING)))
})

/** The host's signed-in identity: a nested `claude` uses its own login and must not report the host's account. */
const HOST_IDENTITY = {
  CLAUDE_CODE_OAUTH_SCOPES: 'user:inference',
  CLAUDE_CODE_ACCOUNT_UUID: 'acc',
  CLAUDE_CODE_ORGANIZATION_UUID: 'org',
  CLAUDE_CODE_USER_EMAIL: 'a@b.test',
  CLAUDE_CODE_DESKTOP_APP_VERSION: '1.0.0',
  CLAUDE_CODE_SKIP_PROMPT_HISTORY: '1',
  AI_AGENT: 'claude-code',
}

it("the host's account identity is dropped; a user's own token and effort stay", () => {
  const user = { CLAUDE_CODE_OAUTH_TOKEN: 'mine', CLAUDE_EFFORT: 'high' }
  expect(buildClaudeChildEnv({ ...HOST_IDENTITY, ...user })).toEqual(user)
  expect(CLAUDE_INHERITED_ENV).toEqual(expect.arrayContaining(Object.keys(HOST_IDENTITY)))
})
