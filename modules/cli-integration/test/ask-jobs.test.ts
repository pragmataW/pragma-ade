import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLI_ERROR } from '../src/contract'
import { createAskJobs } from '../src/main/ask/jobs'
import type { AskInput, AskOutcome } from '../src/main/ask/run-ask'
import { CliError } from '../src/main/cli-error'
import { context, silentLog } from './support/fakes'

const POLL = 1000
const ABANDON = 5000
const input: AskInput = { context: context(), to: 'claude', prompt: 'q', timeoutSeconds: 60 }
const outcome: AskOutcome = {
  profile: { id: 'claude', name: 'Claude', providerId: 'claude' },
  text: '42',
  truncated: false,
  durationMs: 5,
}

interface Pending {
  resolve(o: AskOutcome): void
  reject(e: unknown): void
  signal: AbortSignal
}

function controlled() {
  const runs: Pending[] = []
  const run = (_i: AskInput, signal: AbortSignal) =>
    new Promise<AskOutcome>((resolve, reject) => {
      runs.push({ resolve, reject, signal })
    })
  const jobs = createAskJobs(run, { log: silentLog(), pollWaitMs: POLL, abandonMs: ABANDON })
  return { jobs, runs }
}

const caught = async (p: Promise<unknown>) => {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  )
  expect(e).toBeInstanceOf(CliError)
  return e as CliError
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('createAskJobs', () => {
  it('a quick answer comes back from start', async () => {
    const jobs = createAskJobs(async () => outcome, { log: silentLog(), pollWaitMs: POLL, abandonMs: ABANDON })
    const poll = await jobs.start(input)
    expect(poll).toMatchObject({ status: 'answered', text: '42' })
    expect(poll.askId).toBeTruthy()
  })

  it('a slow answer is pending, then answered from wait', async () => {
    const { jobs, runs } = controlled()
    const first = jobs.start(input)
    await vi.advanceTimersByTimeAsync(POLL)
    const pending = await first
    expect(pending).toEqual({ status: 'pending', askId: pending.askId })
    const second = jobs.wait(pending.askId)
    runs[0]?.resolve(outcome)
    expect(await second).toEqual({ status: 'answered', askId: pending.askId, ...outcome })
  })

  it('a failure is rethrown from wait, once', async () => {
    const { jobs, runs } = controlled()
    const first = jobs.start(input)
    await vi.advanceTimersByTimeAsync(POLL)
    const { askId } = await first
    runs[0]?.reject(new CliError(CLI_ERROR.timeout, 'slow'))
    const e = await caught(jobs.wait(askId))
    expect(e.code).toBe(CLI_ERROR.timeout)
    expect((await caught(jobs.wait(askId))).code).toBe(CLI_ERROR.not_found)
  })

  it('an answer is collected only once', async () => {
    const jobs = createAskJobs(async () => outcome, { log: silentLog(), pollWaitMs: POLL, abandonMs: ABANDON })
    const { askId } = await jobs.start(input)
    const e = await caught(jobs.wait(askId))
    expect(e.code).toBe(CLI_ERROR.not_found)
    expect(e.message).toBe(
      `Question '${askId}' is no longer known (it finished, was abandoned, or Pragma ADE restarted).`,
    )
  })

  it('a job nobody waits for is aborted after abandonMs', async () => {
    const { jobs, runs } = controlled()
    const first = jobs.start(input)
    await vi.advanceTimersByTimeAsync(POLL)
    const { askId } = await first
    expect(runs[0]?.signal.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(ABANDON)
    expect(runs[0]?.signal.aborted).toBe(true)
    expect((await caught(jobs.wait(askId))).code).toBe(CLI_ERROR.not_found)
  })

  it('waiting keeps the job alive', async () => {
    const { jobs, runs } = controlled()
    const first = jobs.start(input)
    await vi.advanceTimersByTimeAsync(POLL)
    const { askId } = await first
    for (let i = 0; i < 10; i++) {
      const w = jobs.wait(askId)
      await vi.advanceTimersByTimeAsync(POLL)
      expect(await w).toMatchObject({ status: 'pending' })
    }
    expect(runs[0]?.signal.aborted).toBe(false)
  })

  it('the job after the concurrency limit is a conflict', async () => {
    const { jobs } = controlled()
    const starts = [1, 2, 3, 4].map(() => jobs.start(input))
    await vi.advanceTimersByTimeAsync(POLL)
    await Promise.all(starts)
    const e = await caught(jobs.start(input))
    expect(e.code).toBe(CLI_ERROR.conflict)
    expect(e.message).toBe('Too many questions are running; wait for one to finish.')
  })

  it('dispose aborts every job', async () => {
    const { jobs, runs } = controlled()
    const starts = [jobs.start(input), jobs.start(input)]
    await vi.advanceTimersByTimeAsync(POLL)
    await Promise.all(starts)
    jobs.dispose()
    expect(runs.map((r) => r.signal.aborted)).toEqual([true, true])
  })
})
