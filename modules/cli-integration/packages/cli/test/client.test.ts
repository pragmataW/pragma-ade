import { describe, expect, it } from 'vitest'
import { AppError, callBridge } from '../src/client'
import { NotRunningError } from '../src/connection'
import { cliBridge, closedPortUrl, silentServerUrl } from './support/servers'

const payload = { context: { cwd: '/x' } }
const worktrees = {
  projectId: 'p1',
  worktrees: [{ id: 'w1', projectId: 'p1', branch: 'main', path: '/r', isMain: true }],
}
const FAST = { connectTimeoutMs: 300 }

describe('callBridge', () => {
  it('round-trips a request', async () => {
    const server = await cliBridge({ worktreeList: () => ({ ok: true, result: worktrees }) })
    expect(await callBridge(server.connection, 'worktreeList', payload)).toEqual(worktrees)
  })

  it('server error becomes AppError with the same code and message', async () => {
    const error = { code: 'not_found', message: "Worktree 'x' not found." } as const
    const server = await cliBridge({ worktreeList: () => ({ ok: false, error }) })
    const err = await callBridge(server.connection, 'worktreeList', payload).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err).toMatchObject(error)
  })

  it('a result that does not match the schema is an internal AppError', async () => {
    const server = await cliBridge({ worktreeList: () => ({ ok: true, result: { nope: 1 } }) })
    const err = await callBridge(server.connection, 'worktreeList', payload).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'internal', message: expect.stringMatching(/version mismatch/) })
  })

  it('closed port → NotRunningError', async () => {
    const url = await closedPortUrl()
    await expect(callBridge({ url, token: 't' }, 'worktreeList', payload, FAST)).rejects.toThrow(NotRunningError)
  })

  it('rejected token → NotRunningError', async () => {
    const server = await cliBridge({})
    const conn = { url: server.connection.url, token: 'wrong-token-0123456789' }
    await expect(callBridge(conn, 'worktreeList', payload)).rejects.toThrow(/token was rejected/)
  })

  it('silent server → NotRunningError after the connect timeout', async () => {
    const started = Date.now()
    const url = await silentServerUrl()
    await expect(callBridge({ url, token: 't' }, 'worktreeList', payload, FAST)).rejects.toThrow(NotRunningError)
    expect(Date.now() - started).toBeLessThan(2000)
  })
})
