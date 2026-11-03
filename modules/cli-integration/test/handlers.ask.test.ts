import { describe, expect, it } from 'vitest'
import { ASK_DEFAULT_TIMEOUT_SECONDS, ASK_MAX_TIMEOUT_SECONDS, CLI_ERROR } from '../src/contract'
import type { AskJobs } from '../src/main/ask/jobs'
import type { AskInput } from '../src/main/ask/run-ask'
import { CliError } from '../src/main/cli-error'
import { createCliHandlers } from '../src/main/handlers'
import { context, makeDeps } from './support/fakes'

const ctx = context({ worktreeId: 'w1' })
const answered = {
  status: 'answered',
  askId: 'a1',
  profile: { id: 'oc', name: 'OpenCode', providerId: 'opencode' },
  text: '42',
  truncated: false,
  durationMs: 3,
} as const

function setup(over: Partial<AskJobs> = {}) {
  const calls: unknown[] = []
  const asks: AskJobs = {
    start: async (i: AskInput) => {
      calls.push(['start', i])
      return { status: 'pending', askId: 'a1' }
    },
    wait: async (id: string) => {
      calls.push(['wait', id])
      return answered
    },
    dispose: () => {},
    ...over,
  }
  return { calls, h: createCliHandlers(makeDeps({ asks })) }
}

describe('ask handlers', () => {
  it.each([
    ['no prompt', { to: 'oc' }],
    ['empty prompt', { to: 'oc', prompt: '' }],
    ['timeout 0', { to: 'oc', prompt: 'q', timeoutSeconds: 0 }],
    ['timeout too large', { to: 'oc', prompt: 'q', timeoutSeconds: ASK_MAX_TIMEOUT_SECONDS + 1 }],
    ['fractional timeout', { to: 'oc', prompt: 'q', timeoutSeconds: 1.5 }],
  ])('rejects %s', async (_n, body) => {
    const { h, calls } = setup()
    expect(await h.ask({ context: ctx, ...body })).toMatchObject({
      ok: false,
      error: { code: CLI_ERROR.invalid_argument },
    })
    expect(calls).toEqual([])
  })

  it('ask starts the question with the default timeout', async () => {
    const { h, calls } = setup()
    expect(await h.ask({ context: ctx, to: 'oc', prompt: 'q' })).toEqual({
      ok: true,
      result: { status: 'pending', askId: 'a1' },
    })
    expect(calls).toEqual([
      ['start', { context: ctx, to: 'oc', prompt: 'q', timeoutSeconds: ASK_DEFAULT_TIMEOUT_SECONDS }],
    ])
  })

  it('askWait forwards the id', async () => {
    const { h, calls } = setup()
    expect(await h.askWait({ context: ctx, askId: 'a1' })).toEqual({ ok: true, result: answered })
    expect(calls).toEqual([['wait', 'a1']])
  })

  it('a timeout keeps its code', async () => {
    const { h } = setup({
      wait: async () => {
        throw new CliError(CLI_ERROR.timeout, 'OpenCode did not answer within 1 s.')
      },
    })
    expect(await h.askWait({ context: ctx, askId: 'a1' })).toEqual({
      ok: false,
      error: { code: CLI_ERROR.timeout, message: 'OpenCode did not answer within 1 s.' },
    })
  })
})
