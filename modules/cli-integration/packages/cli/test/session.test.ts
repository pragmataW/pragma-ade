import type { CliResult } from '@pragma/module-cli-integration/contract'
import { describe, expect, it } from 'vitest'
import { parseCli } from '../src/args'
import { type CliDeps, type CliIo, run } from '../src/main'
import { formatResult } from '../src/output'

const LOCATED: CliResult<'sessionLocate'> = {
  pragmaSessionId: 's1',
  transcripts: [
    {
      providerId: 'claude',
      providerSessionId: '0b5e7c1a-2f3d-4e5f-8a9b-1c2d3e4f5a6b',
      path: '/home/u/.claude/projects/-repo/0b5e7c1a-2f3d-4e5f-8a9b-1c2d3e4f5a6b.jsonl',
      format: 'Claude Code JSONL (one JSON event per line)',
      cwd: '/repo',
      readCommand: null,
      extraPaths: ['/home/u/.claude/projects/-repo/0b5e7c1a-2f3d-4e5f-8a9b-1c2d3e4f5a6b/subagents/agent-a.jsonl'],
    },
  ],
}

function harness(env: NodeJS.ProcessEnv = {}) {
  const out = { stdout: '', stderr: '', calls: [] as { method: string; payload: unknown }[] }
  const io: CliIo = {
    env,
    cwd: '/repo',
    platform: 'darwin',
    home: '/home/u',
    stdout: (s) => {
      out.stdout += s
    },
    stderr: (s) => {
      out.stderr += s
    },
    readFile: async () => '',
    readStdin: async () => '',
  }
  const deps: CliDeps = {
    version: '9.9.9',
    resolve: async () => ({ url: 'http://127.0.0.1:1', token: 't' }),
    call: async (_ep, method, payload) => {
      out.calls.push({ method, payload })
      return LOCATED
    },
  }
  return { io, deps, out }
}

describe('pragma session', () => {
  it('locate <id> sends the id; current sends only the caller context (PRAGMA_SESSION_ID)', async () => {
    const h = harness({ PRAGMA_SESSION_ID: 's1' })
    expect(await run(['session', 'locate', 'ses_abc'], h.io, h.deps)).toBe(0)
    expect(await run(['session', 'current'], h.io, h.deps)).toBe(0)
    expect(h.out.calls).toEqual([
      { method: 'sessionLocate', payload: { context: { cwd: '/repo', sessionId: 's1' }, sessionId: 'ses_abc' } },
      { method: 'sessionLocate', payload: { context: { cwd: '/repo', sessionId: 's1' } } },
    ])
  })

  it('locate needs an id; current takes none', () => {
    expect(() => parseCli(['session', 'locate'])).toThrow('<id> is required.')
    expect(() => parseCli(['session', 'current', 'x'])).toThrow("Unexpected argument 'x'.")
  })

  it('prints provider, path, format, cwd and related files, then how to hand off', () => {
    expect(formatResult('sessionLocate', LOCATED, false)).toBe(
      [
        'pragma: s1',
        'provider: claude',
        'session: 0b5e7c1a-2f3d-4e5f-8a9b-1c2d3e4f5a6b',
        'path: /home/u/.claude/projects/-repo/0b5e7c1a-2f3d-4e5f-8a9b-1c2d3e4f5a6b.jsonl',
        'format: Claude Code JSONL (one JSON event per line)',
        'cwd: /repo',
        'related: /home/u/.claude/projects/-repo/0b5e7c1a-2f3d-4e5f-8a9b-1c2d3e4f5a6b/subagents/agent-a.jsonl',
        '',
        'To continue in another agent, put the path in a prompt file and run:',
        '  pragma agent spawn --profile <name> --prompt-file <file>',
        '',
      ].join('\n'),
    )
  })

  it('an OpenCode location shows its read command; --json prints the result as is', () => {
    const transcript = {
      ...(LOCATED.transcripts[0] as CliResult<'sessionLocate'>['transcripts'][number]),
      providerId: 'opencode',
      readCommand: 'opencode session export ses_abc',
      extraPaths: [],
    }
    const result = { pragmaSessionId: null, transcripts: [transcript] }
    const text = formatResult('sessionLocate', result, false)
    expect(text).toContain('read: opencode session export ses_abc\n')
    expect(text).not.toContain('pragma:')
    expect(text).not.toContain('related:')
    expect(JSON.parse(formatResult('sessionLocate', result, true))).toEqual({ ok: true, result })
  })

  it('help lists both commands', async () => {
    const h = harness()
    await run(['session', '--help'], h.io, h.deps)
    expect(h.out.stdout).toContain('pragma session locate <id>')
    expect(h.out.stdout).toContain('pragma session current')
  })
})
