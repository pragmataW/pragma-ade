import { INLINE_PROMPT_MAX_CHARS } from '@pragma/module-agents/contract'
import { describeLaunchCapability, fakeCapabilityContext, makeLaunchContext } from '@pragma/module-agents/testing'
import { expect, it } from 'vitest'
import { createLaunchCapability } from '../src/main/launch.capability'

describeLaunchCapability('custom', createLaunchCapability)

const cap = createLaunchCapability(fakeCapabilityContext())

it.each([
  ['Fix it', 'Fix it'],
  ['-v', '-v'],
  ['update', 'update'],
])('prompt %j is passed raw as the final positional', async (p, last) =>
  expect((await cap.buildLaunch(makeLaunchContext({ initialPrompt: p }))).args).toEqual(['--x', last]),
)

it('a long prompt stays inline', async () => {
  const ctx = makeLaunchContext({ initialPrompt: 'z'.repeat(INLINE_PROMPT_MAX_CHARS + 1) })
  const spec = await cap.buildLaunch(ctx)
  expect(spec.args.at(-1)).toHaveLength(INLINE_PROMPT_MAX_CHARS + 1)
  expect(ctx.written).toEqual([])
  expect(spec.tempFiles).toBeUndefined()
})

it('has no seed and no compatibility check', () => {
  expect(cap.seed).toBeUndefined()
  expect(cap.checkCompatibility).toBeUndefined()
})
