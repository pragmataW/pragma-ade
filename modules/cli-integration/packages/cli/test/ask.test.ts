import {
  ASK_DEADLINE_MARGIN_MS,
  ASK_DEFAULT_TIMEOUT_SECONDS,
  ASK_REQUEST_TIMEOUT_MS,
} from '@pragma/module-cli-integration/contract'
import { describe, expect, it } from 'vitest'
import { callAsk } from '../src/ask'
import { AppError } from '../src/client'
import type { CliDeps } from '../src/main'

const EP = { url: 'http://127.0.0.1:1', token: 't' }
const context = { cwd: '/repo' }
const pending = { status: 'pending', askId: 'a1' }
const answered = {
  status: 'answered',
  askId: 'a1',
  profile: { id: 'oc', name: 'OpenCode', providerId: 'opencode' },
  text: '42',
  truncated: false,
  durationMs: 1,
}

function fakeCall(results: unknown[], clock: { t: number }, stepMs = 0) {
  const calls: { method: string; payload: unknown; timeoutMs: number | undefined }[] = []
  const call: CliDeps['call'] = async (_ep, method, payload, o) => {
    calls.push({ method, payload, timeoutMs: o?.timeoutMs })
    clock.t += stepMs
    const next = results.shift()
    if (next instanceof Error) throw next
    return next
  }
  return { call, calls }
}

describe('callAsk', () => {
  it('polls askWait until the answer arrives', async () => {
    const clock = { t: 0 }
    const { call, calls } = fakeCall([pending, pending, answered], clock)
    const payload = { context, to: 'oc', prompt: 'q', timeoutSeconds: 60 }
    expect(await callAsk(call, EP, payload, () => clock.t)).toEqual(answered)
    expect(calls).toEqual([
      { method: 'ask', payload, timeoutMs: ASK_REQUEST_TIMEOUT_MS },
      { method: 'askWait', payload: { context, askId: 'a1' }, timeoutMs: ASK_REQUEST_TIMEOUT_MS },
      { method: 'askWait', payload: { context, askId: 'a1' }, timeoutMs: ASK_REQUEST_TIMEOUT_MS },
    ])
  })

  it('gives up after the timeout plus a margin', async () => {
    const clock = { t: 0 }
    const step = ASK_DEADLINE_MARGIN_MS
    const { call } = fakeCall(Array(100).fill(pending), clock, step)
    const err = await callAsk(call, EP, { context, to: 'oc', prompt: 'q', timeoutSeconds: 60 }, () => clock.t).catch(
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(AppError)
    expect(err).toMatchObject({ code: 'timeout', message: 'No answer within 60 s.' })
  })

  it('uses the default timeout when none is given', async () => {
    const clock = { t: 0 }
    const { call } = fakeCall(Array(1000).fill(pending), clock, ASK_DEADLINE_MARGIN_MS)
    const err = await callAsk(call, EP, { context, to: 'oc', prompt: 'q' }, () => clock.t).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'timeout', message: `No answer within ${ASK_DEFAULT_TIMEOUT_SECONDS} s.` })
  })

  it('a server error propagates', async () => {
    const clock = { t: 0 }
    const boom = new AppError('invalid_argument', "Profile 'Custom' cannot answer questions.")
    const { call } = fakeCall([pending, boom], clock)
    await expect(callAsk(call, EP, { context, to: 'c', prompt: 'q' }, () => clock.t)).rejects.toBe(boom)
  })
})
