import { join } from 'node:path'
import { expect, it } from 'vitest'
import { INLINE_PROMPT_MAX_CHARS, LONG_PROMPT_FILE } from '../../src/contract'
import { perTestDb } from '../support/db'
import { makeService } from '../support/service'

const db = perTestDb()

it('stop sends SIGTERM for term and SIGKILL for kill', async () => {
  const h = makeService(db())
  const s = await h.service.startSession({ worktreeId: 'w1' })
  await h.terminal.stop(s, 'term')
  await h.terminal.stop(s, 'kill')
  expect(h.pty.signals).toEqual(['SIGTERM', 'SIGKILL'])
})

it('spawn tags the pty with the agents owner and session id', async () => {
  const h = makeService(db())
  const s = await h.service.startSession({ worktreeId: 'w1' })
  expect(h.pty.spawns[0]?.opts.tags).toEqual({ owner: 'agents', sessionId: s.id })
})

it('long prompts are written into the session temp dir', async () => {
  const h = makeService(db())
  const prompt = 'p'.repeat(INLINE_PROMPT_MAX_CHARS + 1)
  const s = await h.service.startSession({ worktreeId: 'w1', initialPrompt: prompt })
  const last = h.pty.spawns[0]?.opts.args?.at(-1)
  expect(last).toContain(join(db().dir, 'agents', 'tmp', s.id, LONG_PROMPT_FILE))
})
