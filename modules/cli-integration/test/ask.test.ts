import { mkdtemp, readdir, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aProfile } from '@pragma/module-agents/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type AskCapability, CLI_ERROR, MAX_DOCUMENT_BYTES } from '../src/contract'
import { type AskDeps, type AskInput, buildAskPrompt, runAsk } from '../src/main/ask/run-ask'
import { CliError } from '../src/main/cli-error'
import { FAKE_ASK_ENV, type FakeAskRecord, writeFakeAskBin } from '../testing'
import { aWorktree, context, fakeAgents, fakeProjects, silentLog } from './support/fakes'

let root: string
let tempRoot: string
let bin: string
let wtA: string
let wtB: string

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'ask-run-')))
  tempRoot = join(root, 'tmp')
  wtA = join(root, 'wt-a')
  wtB = join(root, 'wt-b')
  const { mkdir } = await import('node:fs/promises')
  for (const d of [tempRoot, wtA, wtB]) await mkdir(d)
  bin = await writeFakeAskBin(root)
})
afterEach(() => rm(root, { recursive: true, force: true }))

/** A fake provider: the question goes on stdin, stdout is the answer, a non-zero exit fails. */
function fakeAsk(env: Record<string, string> = {}, over: Partial<AskCapability> = {}): AskCapability {
  return {
    async buildAsk(q) {
      await q.writeTempFile('note.md', 'scratch')
      return {
        command: bin,
        args: [q.profile.id],
        env: { PATH: process.env.PATH ?? '', HOME: root, [FAKE_ASK_ENV.record]: join(root, 'record.json'), ...env },
        stdin: q.prompt,
      }
    },
    parseAnswer: (out) =>
      out.exitCode === 0 ? { ok: true, text: out.stdout } : { ok: false, message: `exit ${out.exitCode}` },
    ...over,
  }
}

function setup(ask: AskCapability = fakeAsk({ [FAKE_ASK_ENV.stdout]: '42' })) {
  const projects = fakeProjects({
    worktrees: [aWorktree('wa', { path: wtA }), aWorktree('wb', { path: wtB })],
  })
  const agents = fakeAgents({
    profiles: [
      aProfile({ id: 'claude', name: 'Claude', providerId: 'claude' }),
      aProfile({ id: 'oc', name: 'OpenCode', providerId: 'opencode' }),
      aProfile({ id: 'custom', name: 'Custom', providerId: 'custom' }),
      aProfile({ id: 'off', name: 'Off', providerId: 'claude', enabled: false }),
    ],
  })
  const deps: AskDeps = {
    projects,
    agents,
    nameOf: (p) => p.name ?? p.id,
    providers: () => [
      { id: 'claude', ask },
      { id: 'opencode', ask },
    ],
    tempRoot,
    log: silentLog(),
    now: Date.now,
  }
  return deps
}

const input = (over: Partial<AskInput> = {}): AskInput => ({
  context: context({ worktreeId: 'wb' }),
  to: 'claude',
  prompt: 'What is 6*7?',
  timeoutSeconds: 10,
  ...over,
})
const record = async () => JSON.parse(await readFile(join(root, 'record.json'), 'utf8')) as FakeAskRecord
const failure = async (p: Promise<unknown>) => {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  )
  expect(e).toBeInstanceOf(CliError)
  return e as CliError
}
const signal = () => new AbortController().signal

describe.skipIf(process.platform === 'win32')('runAsk', () => {
  it('answers from the worktree in PRAGMA_WORKTREE_ID', async () => {
    const out = await runAsk(input(), setup(), signal())
    expect(out).toMatchObject({
      profile: { id: 'claude', name: 'Claude', providerId: 'claude' },
      text: '42',
      truncated: false,
    })
    expect(out.durationMs).toBeGreaterThanOrEqual(0)
    const r = await record()
    expect(r.cwd).toBe(wtB)
    expect(r.argv).toEqual(['claude'])
  })

  it('falls back to the worktree containing the cwd', async () => {
    await runAsk(input({ context: context({ cwd: join(wtA, 'src') }) }), setup(), signal())
    expect((await record()).cwd).toBe(wtA)
  })

  it('sends the preamble and wraps the question', async () => {
    await runAsk(input({ to: 'OpenCode' }), setup(), signal())
    const r = await record()
    expect(r.stdin).toBe(buildAskPrompt('What is 6*7?'))
    expect(r.stdin).toContain('consulted by another coding agent')
    expect(r.stdin).toContain('Do not modify')
    expect(r.stdin).toMatch(/<question>\nWhat is 6\*7\?\n<\/question>\n$/)
  })

  it('a profile whose provider cannot answer lists the ones that can', async () => {
    const e = await failure(runAsk(input({ to: 'Custom' }), setup(), signal()))
    expect(e.code).toBe(CLI_ERROR.invalid_argument)
    expect(e.message).toBe("Profile 'Custom' cannot answer questions. Profiles that can: Claude, OpenCode.")
  })

  it('says so when no enabled profile can answer', async () => {
    const deps = { ...setup(), providers: () => [] }
    const e = await failure(runAsk(input({ to: 'Custom' }), deps, signal()))
    expect(e.message).toBe("Profile 'Custom' cannot answer questions. No enabled profile can.")
  })

  it.each([
    ['nope', CLI_ERROR.not_found, "No profile 'nope'"],
    ['Off', CLI_ERROR.invalid_argument, "Profile 'Off' is disabled."],
  ])('profile %s → %s', async (to, code, message) => {
    const e = await failure(runAsk(input({ to }), setup(), signal()))
    expect(e.code).toBe(code)
    expect(e.message).toContain(message)
  })

  it('a timeout has code timeout and removes the temp dir', async () => {
    const deps = setup(fakeAsk({ [FAKE_ASK_ENV.sleepMs]: '30000' }))
    const e = await failure(runAsk(input({ timeoutSeconds: 1 }), deps, signal()))
    expect(e.code).toBe(CLI_ERROR.timeout)
    expect(e.message).toBe('Claude did not answer within 1 s.')
    expect(await readdir(tempRoot)).toEqual([])
  })

  it('cancelling aborts the run', async () => {
    const ac = new AbortController()
    const p = runAsk(input(), setup(fakeAsk({ [FAKE_ASK_ENV.sleepMs]: '30000' })), ac.signal)
    setTimeout(() => ac.abort(), 200)
    const e = await failure(p)
    expect(e.message).toBe('The question was cancelled.')
  })

  it('a parse failure is internal with the provider message', async () => {
    const e = await failure(runAsk(input(), setup(fakeAsk({ [FAKE_ASK_ENV.exit]: '2' })), signal()))
    expect(e.code).toBe(CLI_ERROR.internal)
    expect(e.message).toBe('Claude could not answer: exit 2')
    expect(await readdir(tempRoot)).toEqual([])
  })

  it('a buildAsk error is internal', async () => {
    const ask = fakeAsk(
      {},
      { buildAsk: async () => Promise.reject(new Error("Claude Code command 'x' was not found.")) },
    )
    const e = await failure(runAsk(input(), setup(ask), signal()))
    expect(e.code).toBe(CLI_ERROR.internal)
    expect(e.message).toBe("Claude Code command 'x' was not found.")
    expect(await readdir(tempRoot)).toEqual([])
  })

  it('a missing binary is a start failure', async () => {
    const ask = fakeAsk()
    const broken: AskCapability = {
      ...ask,
      buildAsk: async (q) => ({ ...(await ask.buildAsk(q)), command: join(root, 'missing') }),
    }
    const e = await failure(runAsk(input(), setup(broken), signal()))
    expect(e.message).toMatch(/^Could not start Claude: /)
  })

  it('an over-long answer is cut on a UTF-8 boundary and marked truncated', async () => {
    const long = `a${'é'.repeat(MAX_DOCUMENT_BYTES)}`
    const ask = fakeAsk({}, { parseAnswer: () => ({ ok: true, text: long }) })
    const out = await runAsk(input(), setup(ask), signal())
    expect(out.truncated).toBe(true)
    expect(Buffer.byteLength(out.text)).toBe(MAX_DOCUMENT_BYTES - 1)
    expect(out.text.endsWith('é')).toBe(true)
  })

  it('the temp dir is removed after a success', async () => {
    await runAsk(input(), setup(), signal())
    expect(await readdir(tempRoot)).toEqual([])
  })
})
