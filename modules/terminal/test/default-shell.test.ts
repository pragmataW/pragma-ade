import { expect, test } from 'vitest'
import { defaultShell } from '../src/main/default-shell'

const base = { exists: () => true, resolveCommand: async () => null }

test.each([
  ['darwin', { SHELL: '/bin/zsh' }, null, { command: '/bin/zsh', args: ['-l'] }],
  ['linux', {}, null, { command: '/bin/bash', args: [] }],
  ['darwin', { SHELL: '/bin/zsh' }, '/bin/sh', { command: '/bin/sh', args: [] }],
] as const)('%s %o setting=%s', async (platform, env, settingShell, expected) =>
  expect(await defaultShell({ ...base, platform, env, settingShell })).toEqual(expected),
)

test('falls back to /bin/sh when $SHELL and the platform shell are missing', async () =>
  expect(
    await defaultShell({
      ...base,
      platform: 'linux',
      env: { SHELL: '/nope/fish' },
      settingShell: null,
      exists: (p) => p === '/bin/sh',
    }),
  ).toEqual({ command: '/bin/sh', args: [] }))

test.each([
  ['C:\\pwsh\\pwsh.exe', 'C:\\pwsh\\pwsh.exe'],
  [null, 'powershell.exe'],
])('win32 with resolveCommand(pwsh.exe)=%s → %s', async (resolved, command) =>
  expect(
    await defaultShell({
      ...base,
      platform: 'win32',
      env: {},
      settingShell: null,
      resolveCommand: async () => resolved,
    }),
  ).toEqual({ command, args: [] }),
)
