import { randomUUID } from 'node:crypto'
import type { Logger } from '@pragma/sdk'
import { ASK_ABANDON_MS, ASK_MAX_CONCURRENT } from '../../constants'
import { ASK_POLL_WAIT_MS, ASK_STATE, CLI_ERROR } from '../../contract'
import { CliError } from '../cli-error'
import type { AskInput, AskOutcome } from './run-ask'

export type AskPoll =
  | { status: typeof ASK_STATE.pending; askId: string }
  | ({
      status: typeof ASK_STATE.answered
      askId: string
    } & AskOutcome)

/** Questions running in the background, collected by long-polling (`ask` starts, `askWait` waits again). */
export interface AskJobs {
  /** `conflict` when `ASK_MAX_CONCURRENT` questions are already running. */
  start(input: AskInput): Promise<AskPoll>
  /** `not_found` for unknown, collected or abandoned ids. */
  wait(askId: string): Promise<AskPoll>
  /** Aborts every question (module deactivation). */
  dispose(): void
}

export interface AskJobsOptions {
  log: Logger
  pollWaitMs?: number
  abandonMs?: number
}

export type AskRun = (input: AskInput, signal: AbortSignal) => Promise<AskOutcome>

type Settled = { ok: true; value: AskOutcome } | { ok: false; error: unknown }

interface Job {
  id: string
  controller: AbortController
  done: Promise<Settled>
  settled: boolean
  abandon: ReturnType<typeof setTimeout> | undefined
}

const TOO_MANY = 'Too many questions are running; wait for one to finish.'
const unknownQuestion = (id: string) =>
  `Question '${id}' is no longer known (it finished, was abandoned, or Pragma ADE restarted).`

/** Starts `run`; the job's `done` never rejects, so an uncollected failure is not an unhandled rejection. */
function launch(run: AskRun, input: AskInput): Job {
  const controller = new AbortController()
  const settle = (s: Settled): Settled => {
    job.settled = true
    return s
  }
  const job: Job = {
    id: randomUUID(),
    controller,
    settled: false,
    abandon: undefined,
    done: run(input, controller.signal).then(
      (value) => settle({ ok: true, value }),
      (error: unknown) => settle({ ok: false, error }),
    ),
  }
  return job
}

export function createAskJobs(run: AskRun, o: AskJobsOptions): AskJobs {
  const pollWaitMs = o.pollWaitMs ?? ASK_POLL_WAIT_MS
  const abandonMs = o.abandonMs ?? ASK_ABANDON_MS
  const jobs = new Map<string, Job>()

  const remove = (job: Job) => {
    clearTimeout(job.abandon)
    jobs.delete(job.id)
  }
  const armAbandon = (job: Job) => {
    clearTimeout(job.abandon)
    job.abandon = setTimeout(() => {
      if (!job.settled) o.log.warn(`cli-integration: question ${job.id} was abandoned; stopping it`)
      job.controller.abort()
      remove(job)
    }, abandonMs)
  }

  const poll = async (job: Job): Promise<AskPoll> => {
    clearTimeout(job.abandon)
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), pollWaitMs)
    })
    const result = await Promise.race([job.done, timeout])
    clearTimeout(timer)
    if (!jobs.has(job.id)) throw new CliError(CLI_ERROR.not_found, unknownQuestion(job.id))
    if (result === null) {
      armAbandon(job)
      return { status: ASK_STATE.pending, askId: job.id }
    }
    remove(job)
    if (!result.ok) throw result.error
    return { status: ASK_STATE.answered, askId: job.id, ...result.value }
  }

  return {
    start(input) {
      const running = [...jobs.values()].filter((j) => !j.settled).length
      if (running >= ASK_MAX_CONCURRENT) return Promise.reject(new CliError(CLI_ERROR.conflict, TOO_MANY))
      const job = launch(run, input)
      jobs.set(job.id, job)
      return poll(job)
    },
    wait(askId) {
      const job = jobs.get(askId)
      if (!job) return Promise.reject(new CliError(CLI_ERROR.not_found, unknownQuestion(askId)))
      return poll(job)
    },
    dispose() {
      for (const job of [...jobs.values()]) {
        job.controller.abort()
        remove(job)
      }
    },
  }
}
