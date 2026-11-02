import type { ProviderDescriptor } from '@pragma/sdk'
import { expect, test } from 'vitest'
import { TERMINAL_ENV_CAPABILITY, type TerminalEnvCapability } from '../src/contract'
import { inheritedEnvKeys, scrubInheritedEnv } from '../src/main/inherited-env'

const descriptor = (id: string): ProviderDescriptor => ({
  id,
  displayNameKey: `${id}:module.name`,
  icon: id,
  defaultCommand: id,
  defaultArgs: [],
})

function fakeProviders(caps: Record<string, TerminalEnvCapability | undefined>) {
  const ids = Object.keys(caps)
  return {
    providersWith: (key: string) => (key === TERMINAL_ENV_CAPABILITY ? ids.map(descriptor) : []),
    capability: (id: string, key: string) => (key === TERMINAL_ENV_CAPABILITY ? caps[id] : undefined),
  }
}

test('inheritedEnvKeys unions every provider terminalEnv capability, deduplicated', () => {
  const providers = fakeProviders({
    a: { inheritedEnvKeys: ['A_SESSION', 'SHARED'] },
    b: { inheritedEnvKeys: ['SHARED', 'B_CHILD'] },
    c: undefined,
  })
  expect([...inheritedEnvKeys(providers)].sort()).toEqual(['A_SESSION', 'B_CHILD', 'SHARED'])
})

test('inheritedEnvKeys is empty without providers', () => {
  expect(inheritedEnvKeys(fakeProviders({}))).toEqual([])
})

test('scrubInheritedEnv drops the keys and never a PRAGMA_ variable', () => {
  const env = { CLAUDECODE: '1', PRAGMA_SESSION_ID: 's1', PATH: '/bin', KEEP: 'y' }
  expect(scrubInheritedEnv(env, ['CLAUDECODE', 'PRAGMA_SESSION_ID', 'MISSING'])).toEqual({
    PRAGMA_SESSION_ID: 's1',
    PATH: '/bin',
    KEEP: 'y',
  })
})
