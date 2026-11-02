import { aSession } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { createCliHandlers } from '../src/main/handlers'
import { aTranscript, aWorktree, fakeAgents, fakeProjects, fakeTranscripts, makeDeps } from './support/fakes'

const CLAUDE_ID = '0b5e7c1a-2f3d-4e5f-8a9b-1c2d3e4f5a6b'
const OPENCODE_ID = 'ses_243bb3210ffemQttpEg5Uphr7t'
const OC_LOCATION = aTranscript({ path: '/home/.local/share/opencode/opencode.db', readCommand: 'opencode x' })

function setup() {
  const transcripts = fakeTranscripts({
    claude: { [CLAUDE_ID]: aTranscript() },
    opencode: { [OPENCODE_ID]: OC_LOCATION },
  })
  const agents = fakeAgents({
    sessions: [
      aSession('s1', 1, { worktreeId: 'w1', providerId: 'claude', externalSessionId: CLAUDE_ID }),
      aSession('s2', 2, { worktreeId: 'w1', providerId: 'opencode' }),
    ],
  })
  const projects = fakeProjects({ worktrees: [aWorktree('w1', { path: '/repo' })] })
  const handlers = createCliHandlers(makeDeps({ agents, projects, transcripts }))
  const locate = (payload: Record<string, unknown>) =>
    handlers.sessionLocate({ context: { cwd: '/cwd' }, ...payload }) as Promise<{ ok: boolean; [k: string]: unknown }>
  return { transcripts, locate }
}

describe('cli.sessionLocate', () => {
  it('a Pragma session id asks only its provider, with the worktree path as cwd', async () => {
    const t = setup()
    expect(await t.locate({ sessionId: 's1' })).toEqual({
      ok: true,
      result: {
        pragmaSessionId: 's1',
        transcripts: [{ ...aTranscript(), providerId: 'claude', providerSessionId: CLAUDE_ID }],
      },
    })
    expect(t.transcripts.queries).toEqual([['claude', { sessionId: CLAUDE_ID, cwd: '/repo', home: '/home', env: {} }]])
  })

  it('without an id the caller session (PRAGMA_SESSION_ID) is used', async () => {
    const t = setup()
    const res = await t.locate({ context: { cwd: '/cwd', sessionId: 's1' } })
    expect(res).toMatchObject({ ok: true, result: { pragmaSessionId: 's1' } })
  })

  it('an id Pragma does not know is searched in every provider (sessions started outside Pragma)', async () => {
    const t = setup()
    expect(await t.locate({ sessionId: OPENCODE_ID })).toEqual({
      ok: true,
      result: {
        pragmaSessionId: null,
        transcripts: [{ ...OC_LOCATION, providerId: 'opencode', providerSessionId: OPENCODE_ID }],
      },
    })
    expect(t.transcripts.queries.map(([id, q]) => [id, q.cwd])).toEqual([
      ['claude', '/cwd'],
      ['opencode', '/cwd'],
    ])
  })

  it('errors: no id at all, no provider session id yet, nothing found', async () => {
    const t = setup()
    expect(await t.locate({})).toMatchObject({ ok: false, error: { code: 'invalid_argument' } })
    expect(await t.locate({ sessionId: 's2' })).toMatchObject({
      ok: false,
      error: { code: 'not_found', message: "Session 's2' has not reported a provider session id yet." },
    })
    expect(await t.locate({ sessionId: 'nope' })).toMatchObject({
      ok: false,
      error: { code: 'not_found', message: "No local transcript found for session 'nope'." },
    })
  })

  it('a provider that throws is skipped', async () => {
    const transcripts = fakeTranscripts({ claude: { [CLAUDE_ID]: aTranscript() } })
    const broken = {
      id: 'broken',
      transcript: {
        locateTranscript: async () => {
          throw new Error('boom')
        },
      },
    }
    const providers = transcripts.providers
    const handlers = createCliHandlers(
      makeDeps({ transcripts: { ...transcripts, providers: () => [broken, ...providers()] } }),
    )
    const res = await handlers.sessionLocate({ context: { cwd: '/' }, sessionId: CLAUDE_ID })
    expect(res).toMatchObject({ ok: true, result: { transcripts: [{ providerId: 'claude' }] } })
  })
})
