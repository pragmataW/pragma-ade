import { expect, it, vi } from 'vitest'
import { commandResolutionSchema } from '../../src/contract'
import { createResolve } from '../../src/main/launch/resolve'

it.each([
  ['dgc', '/usr/local/bin/dgc', { status: 'found', path: '/usr/local/bin/dgc' }],
  ['missing', null, { status: 'notFound' }],
])('maps the SDK result for %s', async (command, sdkResult, expected) => {
  const sdk = vi.fn(async () => sdkResult)
  const result = await createResolve(sdk)(command)
  expect(result).toEqual(expected)
  expect(commandResolutionSchema.parse(result)).toEqual(expected)
  expect(sdk).toHaveBeenCalledWith(command)
})

it('a blank command is not found without asking the SDK', async () => {
  const sdk = vi.fn(async () => '/x')
  expect(await createResolve(sdk)('  ')).toEqual({ status: 'notFound' })
  expect(sdk).not.toHaveBeenCalled()
})
