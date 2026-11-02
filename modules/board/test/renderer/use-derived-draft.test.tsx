import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDerivedDraft } from '../../src/renderer/lib/use-derived-draft'

const render = (initial: string) =>
  renderHook(({ derived }) => useDerivedDraft(derived), { initialProps: { derived: initial } })

describe('useDerivedDraft', () => {
  it('follows the derived value while untouched (Start work branch after a title edit)', () => {
    const hook = render('feat/pra-1-untitled-task')
    expect(hook.result.current[0]).toBe('feat/pra-1-untitled-task')
    hook.rerender({ derived: 'feat/pra-1-fix-login' })
    expect(hook.result.current[0]).toBe('feat/pra-1-fix-login')
  })

  it('keeps the user edit when the derived value changes', () => {
    const hook = render('feat/pra-1-untitled-task')
    act(() => hook.result.current[1]('feat/my-branch'))
    hook.rerender({ derived: 'feat/pra-1-fix-login' })
    expect(hook.result.current[0]).toBe('feat/my-branch')
  })

  it('an edit to an empty value is still an edit', () => {
    const hook = render('feat/pra-1-a')
    act(() => hook.result.current[1](''))
    hook.rerender({ derived: 'feat/pra-1-b' })
    expect(hook.result.current[0]).toBe('')
  })
})
