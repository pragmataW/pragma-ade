import { afterEach, describe, expect, it } from 'vitest'
import { EDITOR_OPEN_DIFF_COMMAND, FAKE_EDITOR_ENV } from '../src/constants'
import testHooks, { editorCallsIpc } from '../src/main/test-hooks'
import { fakeMainCtx } from '../testing'

afterEach(() => {
  delete process.env[FAKE_EDITOR_ENV]
})

describe('git-changes test hooks', () => {
  it('records editor.openDiff calls when the fake editor is enabled', async () => {
    process.env[FAKE_EDITOR_ENV] = '1'
    const t = fakeMainCtx()
    await testHooks(t.ctx)
    await t.ctx.commands.execute(EDITOR_OPEN_DIFF_COMMAND, { worktreeId: 'w', path: 'a.ts', line: 3 })
    expect(await t.invoke(editorCallsIpc, {})).toEqual([{ worktreeId: 'w', path: 'a.ts', line: 3 }])
  })

  it.each([
    ['the env switch is off', false, false],
    ['a real editor registered the command', true, true],
  ])('registers nothing when %s', async (_name, env, editorPresent) => {
    if (env) process.env[FAKE_EDITOR_ENV] = '1'
    const t = fakeMainCtx()
    if (editorPresent) t.ctx.commands.register(EDITOR_OPEN_DIFF_COMMAND, () => undefined)
    await testHooks(t.ctx)
    await expect(t.invoke(editorCallsIpc, {})).rejects.toThrow('no handler')
  })
})
