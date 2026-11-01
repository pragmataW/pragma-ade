import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { type ChangeList, type ChangeMode, changesChangedEvent, listChangesIpc } from '../src/contract'
import { setRendererCtx } from '../src/renderer/lib/sdk'
import { useChangeList } from '../src/renderer/use-changes'
import { installDeferredIpc } from './helpers/deferred-ipc'

const listOf = (worktreeId: string): ChangeList => ({
  state: 'baseNotFound',
  worktreeId,
  mode: 'branch',
  baseBranch: 'main',
})
const MODE: ChangeMode = 'branch'

afterEach(() => setRendererCtx(undefined))

describe('useChangeList', () => {
  it('ignores stale responses', async () => {
    const ipc = installDeferredIpc()
    const { result, rerender } = renderHook(({ id }) => useChangeList(id, MODE), { initialProps: { id: 'A' } })
    rerender({ id: 'B' })
    const [forA, forB] = ipc.on(listChangesIpc.channel)
    expect([forA?.input, forB?.input]).toEqual([
      { worktreeId: 'A', mode: MODE },
      { worktreeId: 'B', mode: MODE },
    ])
    await act(async () => forB?.answer.resolve(listOf('B')))
    await act(async () => forA?.answer.resolve(listOf('A')))
    expect(result.current.data).toEqual(listOf('B'))
  })

  it('never shows the previous worktree while the new one loads', async () => {
    const ipc = installDeferredIpc()
    const { result, rerender } = renderHook(({ id }) => useChangeList(id, MODE), { initialProps: { id: 'A' } })
    await act(async () => ipc.on(listChangesIpc.channel)[0]?.answer.resolve(listOf('A')))
    expect(result.current.data).toEqual(listOf('A'))
    rerender({ id: 'B' })
    expect(result.current.data).toBeUndefined()
  })

  it.each([
    ['the same worktree refetches', 'A', 2],
    ['another worktree does not', 'Z', 1],
  ])('changesChangedEvent for %s', async (_name, worktreeId, calls) => {
    const ipc = installDeferredIpc()
    renderHook(() => useChangeList('A', MODE))
    await act(async () => ipc.on(listChangesIpc.channel)[0]?.answer.resolve(listOf('A')))
    act(() => ipc.fire(changesChangedEvent, { worktreeId }))
    await waitFor(() => expect(ipc.on(listChangesIpc.channel)).toHaveLength(calls))
  })
})
