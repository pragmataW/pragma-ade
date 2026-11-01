import { expect, test } from 'vitest'
import { COMMENTS_CHANNELS, type CommentsService, commentsIpc } from '../src/contract'
import { registerCommentsIpc } from '../src/main/ipc'
import type { CommentsServiceImpl } from '../src/main/service'
import { createCommentsTestHooks } from '../src/main/test-hooks'
import { WT } from './factories'
import { createFakeIpc } from './fakes'

/** A service whose every method records its arguments and resolves to its name. */
function recordingService() {
  const calls: [string, unknown[]][] = []
  const service = new Proxy({} as CommentsServiceImpl, {
    get:
      (_t, name) =>
      (...args: unknown[]) => {
        calls.push([String(name), args])
        return name === 'addDraft' ? { id: 'c1', ...(args[0] as object) } : name
      },
  })
  return { service, calls }
}

test('registers every channel in COMMENTS_CHANNELS', () => {
  const ipc = createFakeIpc()
  registerCommentsIpc(ipc, recordingService().service as CommentsService)
  expect([...ipc.handlers.keys()].sort()).toEqual(Object.values(COMMENTS_CHANNELS).sort())
})

test('comments.send passes promptUser:false', async () => {
  const ipc = createFakeIpc()
  const { service, calls } = recordingService()
  registerCommentsIpc(ipc, service)
  await ipc.invoke(commentsIpc.send, { commentIds: ['a'], targetSessionId: 's1' })
  expect(calls).toEqual([['send', [['a'], 's1', { promptUser: false }]]])
})

test('test hook createDraft fills defaults and goes through addDraft', async () => {
  const { service, calls } = recordingService()
  const hooks = createCommentsTestHooks(service)
  await hooks.createDraft({ worktreeId: WT, body: 'Custom.' })
  expect(calls[0]?.[0]).toBe('addDraft')
  expect(calls[0]?.[1][0]).toMatchObject({
    worktreeId: WT,
    source: 'diff',
    filePath: 'src/example.ts',
    body: 'Custom.',
  })
  hooks.setPendingOptions({ readyQuietMs: 5 })
  expect(calls[1]).toEqual(['setPendingOptions', [{ readyQuietMs: 5 }]])
})
