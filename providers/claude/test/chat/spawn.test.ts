import { EventEmitter } from 'node:events'
import type { SpawnOptions } from '@anthropic-ai/claude-agent-sdk'
import { describe, expect, it, vi } from 'vitest'
import { buildClaudeChildEnv } from '../../src/main/chat/env'
import { createClaudeProcessSpawn, type SpawnDeps } from '../../src/main/chat/spawn'
import { startSession } from './support'

const SDK_FLAGS = ['--output-format', 'stream-json', '--verbose', '--input-format', 'stream-json']
/** `--flag=value` and `--flag value` spellings normalized (the SDK uses the former). */
const normalize = (argv: string[]) =>
  argv.flatMap((a) => (a.startsWith('--') && a.includes('=') ? a.split(/=(.*)/s).slice(0, 2) : [a]))
const after = (argv: string[], flag: string) => {
  const n = normalize(argv)
  return n.includes(flag) ? n[n.indexOf(flag) + 1] : undefined
}

describe('Claude chat spawn contract (real SDK + fake CLI)', () => {
  it('inserts profile args before SDK flags', async () => {
    const { report } = await startSession('basic', { args: ['--wrapper-flag', 'x'] })
    const argv = report()?.argv ?? []
    expect(argv.slice(0, 2)).toEqual(['--wrapper-flag', 'x'])
    expect(argv.slice(2, 2 + SDK_FLAGS.length)).toEqual(SDK_FLAGS)
  })

  it('inserts prefix after script for .mjs executables', () => {
    const calls: string[][] = []
    const child = Object.assign(new EventEmitter(), { stderr: new EventEmitter(), pid: 1, kill: vi.fn() })
    const deps: SpawnDeps = {
      spawn: ((_cmd: string, args: string[]) => {
        calls.push(args)
        return child
      }) as unknown as SpawnDeps['spawn'],
      killGraceMs: 10,
    }
    const spawner = createClaudeProcessSpawn({ command: '/opt/cli.mjs', prefixArgs: ['--p', '1'] }, deps)
    const o = { command: 'node', args: ['/opt/cli.mjs', ...SDK_FLAGS], env: {}, signal: new AbortController().signal }
    spawner.spawn(o as SpawnOptions)
    expect(calls[0]?.slice(0, 3)).toEqual(['/opt/cli.mjs', '--p', '1'])
  })

  it('--session-id for new, --resume without --session-id for resumed', async () => {
    const fresh = await startSession('basic')
    expect(after(fresh.report()?.argv ?? [], '--session-id')).toBe(fresh.session.externalSessionId)
    const resumed = await startSession('basic', { ctx: { resumeExternalSessionId: fresh.session.externalSessionId } })
    const argv = resumed.report()?.argv ?? []
    expect(after(argv, '--resume')).toBe(fresh.session.externalSessionId)
    expect(normalize(argv)).not.toContain('--session-id')
  })

  it.each([
    [[], 'default'],
    [['--dangerously-skip-permissions'], undefined],
    [['--permission-mode=plan'], undefined],
  ])('--permission-mode default unless profile args carry a permission flag (%o)', async (args, mode) => {
    const { report } = await startSession('basic', { args })
    const argv = report()?.argv ?? []
    expect(after(argv.slice(args.length), '--permission-mode')).toBe(mode)
  })

  it('child env keeps PROFILE_MARK and strips CLAUDECODE', async () => {
    const { report } = await startSession('basic', { env: { PROFILE_MARK: '1', CLAUDECODE: '1' } })
    expect(report()?.env.PROFILE_MARK).toBe('1')
    expect(buildClaudeChildEnv({ CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'x', KEEP: 'y' })).toEqual({ KEEP: 'y' })
  })

  it('cwd is the worktree realpath', async () => {
    const { report, home } = await startSession('basic')
    expect(report()?.cwd).toBe(home.worktree)
  })
})
