import { afterEach, describe, expect, it } from 'vitest'
import { passwordForServerUrl } from '../src/main/chat/server/passwords'
import { chatSetup, cleanupAll, fakeProfile, fakeUrl, isAlive, readLog } from '../testing/fake-opencode-server/harness'

afterEach(cleanupAll)

const servePid = (log: string) =>
  readLog(log)
    .flatMap((r) => (r.kind === 'start' ? [r.pid] : []))
    .at(-1) ?? -1
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const SETTLE_MS = 300

describe('opencode retainServer (11c)', () => {
  it('live serve → url and an extra lease that keeps it running after the chat closes; release stops it', async () => {
    const s = chatSetup()
    const handle = await s.start()
    const query = {
      worktreePath: s.ctx.worktreePath,
      profile: s.ctx.profile,
      externalSessionId: handle.externalSessionId,
    }
    const retained = await s.cap.retainServer?.(query)
    expect(retained?.url).toBe(fakeUrl(s.h.log))
    expect(passwordForServerUrl(retained?.url ?? '')).toBeTruthy()
    const pid = servePid(s.h.log)
    await handle.close()
    await sleep(SETTLE_MS)
    expect(isAlive(pid)).toBe(true)
    await retained?.release()
    await sleep(SETTLE_MS)
    expect(isAlive(pid)).toBe(false)
  })

  it.each([
    ['another session id', { externalSessionId: 'ses_other' }],
    ['another profile', { profile: { ...fakeProfile(), id: 'builtin:other' } }],
    ['another worktree', { worktreePath: '/elsewhere' }],
  ])('no serve for %s → undefined', async (_n, patch) => {
    const s = chatSetup()
    const handle = await s.start()
    const base = {
      worktreePath: s.ctx.worktreePath,
      profile: s.ctx.profile,
      externalSessionId: handle.externalSessionId,
    }
    expect(await s.cap.retainServer?.({ ...base, ...patch })).toBeUndefined()
  })
})
