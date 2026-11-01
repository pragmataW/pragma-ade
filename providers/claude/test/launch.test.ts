import { INLINE_PROMPT_MAX_CHARS, LONG_PROMPT_FILE, longPromptInstruction } from '@pragma/module-agents/contract'
import { describeLaunchCapability, fakeCapabilityContext, makeLaunchContext } from '@pragma/module-agents/testing'
import { expect, it } from 'vitest'
import { createLaunchCapability } from '../src/main/launch.capability'

describeLaunchCapability('claude', createLaunchCapability)

const cap = createLaunchCapability(fakeCapabilityContext())
const argsFor = async (initialPrompt: string) => (await cap.buildLaunch(makeLaunchContext({ initialPrompt }))).args

it.each([
  ['Fix the login bug', ['--x', 'Fix the login bug']],
  ['line one\n"quoted" $HOME a=b=c', ['--x', 'line one\n"quoted" $HOME a=b=c']],
])('prompt %j is the final positional', async (p, args) => expect(await argsFor(p)).toEqual(args))

it('claude: single-word prompt is not dispatched as a subcommand', async () =>
  expect(await argsFor('update')).toEqual(['--x', ' update']))

it('claude: leading dash prompt', async () => expect(await argsFor('-v please')).toEqual(['--x', ' -v please']))

it('long prompt goes to a temp file', async () => {
  const ctx = makeLaunchContext({ initialPrompt: 'y'.repeat(INLINE_PROMPT_MAX_CHARS + 1) })
  const spec = await cap.buildLaunch(ctx)
  expect(spec.tempFiles).toEqual([`/tmp/s/${LONG_PROMPT_FILE}`])
  expect(spec.args.at(-1)).toBe(longPromptInstruction(`/tmp/s/${LONG_PROMPT_FILE}`))
  expect(ctx.written).toHaveLength(1)
})

it('seeds the first built-in profile', () => {
  expect(cap.seed?.order).toBe(10)
  expect(cap.checkCompatibility).toBeUndefined()
})
