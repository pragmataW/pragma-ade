import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentProfile } from '@pragma/module-agents/contract'
import { aProfile, fakeCapabilityContext } from '@pragma/module-agents/testing'
import type { CapabilityContext } from '@pragma/sdk'
import type { AskAnswer, AskCapability, AskSpec } from '../src/contract'
import { runAskProcess } from '../src/main/ask/process'
import { FAKE_ASK_ENV, type FakeAskRecord, writeFakeAskBin } from './fake-ask-bin'

export { runAskProcess }

export interface FakeAskOptions {
  /** What the fake CLI prints on stdout. */
  stdout: string
  stderr?: string
  exitCode?: number
  profile?: Partial<AgentProfile>
  prompt?: string
  /** Extra shell env (e.g. a parent Claude session's stamps). */
  shellEnv?: Record<string, string>
  /** `resolveCommand` answers null (the command is not installed). */
  unresolvable?: boolean
}

export interface FakeAskResult {
  spec: AskSpec
  answer: AskAnswer
  record: FakeAskRecord
  /** Files the capability wrote with `writeTempFile`. */
  written: { name: string; path: string; contents: string }[]
  /** The commands `resolveCommand` was asked for. */
  resolved: string[]
  home: string
  cwd: string
}

const TIMEOUT_MS = 10_000

/**
 * Runs a provider's `ask` capability end to end against a fake CLI in a temp dir (temp HOME, temp cwd); the fake
 * records argv, stdin, cwd and env. POSIX only.
 */
export async function askWithFakeBinary(
  create: (c: CapabilityContext) => AskCapability,
  o: FakeAskOptions,
): Promise<FakeAskResult> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'ask-cap-')))
  try {
    const bin = await writeFakeAskBin(root)
    const record = join(root, 'record.json')
    const resolved: string[] = []
    const shellEnv = {
      PATH: process.env.PATH ?? '',
      HOME: root,
      [FAKE_ASK_ENV.record]: record,
      [FAKE_ASK_ENV.stdout]: o.stdout,
      [FAKE_ASK_ENV.stderr]: o.stderr ?? '',
      [FAKE_ASK_ENV.exit]: String(o.exitCode ?? 0),
      ...o.shellEnv,
    }
    const cap = create(
      fakeCapabilityContext({
        resolveCommand: async (cmd) => {
          resolved.push(cmd)
          return o.unresolvable ? null : bin
        },
        getShellEnv: async () => shellEnv,
      }),
    )
    const written: FakeAskResult['written'] = []
    const spec = await cap.buildAsk({
      profile: aProfile(o.profile),
      cwd: root,
      prompt: o.prompt ?? 'What is 2+2?',
      async writeTempFile(name, contents) {
        const path = join(root, name)
        await writeFile(path, contents, { mode: 0o600 })
        written.push({ name, path, contents })
        return path
      },
    })
    const out = await runAskProcess(spec, { cwd: root, timeoutMs: TIMEOUT_MS })
    if (out.kind !== 'exited') throw new Error(`fake CLI did not exit: ${out.kind}`)
    const answer = cap.parseAnswer(out)
    const parsed = JSON.parse(await readFile(record, 'utf8')) as FakeAskRecord
    return { spec, answer, record: parsed, written, resolved, home: root, cwd: root }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
