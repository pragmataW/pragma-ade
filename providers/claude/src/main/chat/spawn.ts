// MIT License — Copyright (c) 2026 Lovecast Inc. (stablyai/orca)
// Derived from orca src/main/claude/claude-agent-sdk-process-spawn.ts.
// Modified for Pragma ADE: plain `child_process.spawn` (no supervisor), profile args as prefix, a stderr tail buffer,
// exit/error bookkeeping for startup diagnostics, SIGTERM → SIGKILL kill ladder.
import { type ChildProcess, spawn as nodeSpawn } from 'node:child_process'
import type { SpawnedProcess, SpawnOptions } from '@anthropic-ai/claude-agent-sdk'
import { ABORT_EVENT, KILL_GRACE_MS, SCRIPT_EXECUTABLE_RE, SIGKILL, SIGTERM, STDERR_TAIL_BYTES } from './constants'

export interface ClaudeLaunch {
  command: string
  /** The profile args, placed before the SDK's flags. */
  prefixArgs: string[]
}

export interface ExitInfo {
  code: number | null
  signal: NodeJS.Signals | null
}

export interface ClaudeProcessSpawn {
  /** The SDK `spawnClaudeCodeProcess` hook. */
  spawn(o: SpawnOptions): SpawnedProcess
  stderrTail(): string
  exitInfo(): ExitInfo | null
  spawnError(): NodeJS.ErrnoException | null
  /** Resolves once the child exited (immediately when it never spawned or already exited). */
  exited(): Promise<ExitInfo | null>
  /** SIGTERM, then SIGKILL after `KILL_GRACE_MS`; `force` sends SIGKILL now. */
  kill(force?: boolean): void
}

export interface SpawnDeps {
  spawn: typeof nodeSpawn
  killGraceMs: number
}

const STDIO = ['pipe', 'pipe', 'pipe'] as const

function definedEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) if (v !== undefined) out[k] = v
  return out
}

/** Profile args go first (after the script when the executable is a JS/TS script the SDK runs through node). */
export function withPrefixArgs(launch: ClaudeLaunch, sdkArgs: readonly string[]): string[] {
  const args = [...sdkArgs]
  args.splice(SCRIPT_EXECUTABLE_RE.test(launch.command) ? 1 : 0, 0, ...launch.prefixArgs)
  return args
}

export function createClaudeProcessSpawn(
  launch: ClaudeLaunch,
  deps: SpawnDeps = { spawn: nodeSpawn, killGraceMs: KILL_GRACE_MS },
): ClaudeProcessSpawn {
  let child: ChildProcess | null = null
  let exit: ExitInfo | null = null
  let error: NodeJS.ErrnoException | null = null
  let tail = ''
  const waiters: ((e: ExitInfo | null) => void)[] = []
  const settle = () => {
    for (const w of waiters.splice(0)) w(exit)
  }
  const kill = (force = false) => {
    if (!child || exit) return
    const c = child
    c.kill(force ? SIGKILL : SIGTERM)
    if (force) return
    setTimeout(() => {
      if (!exit) c.kill(SIGKILL)
    }, deps.killGraceMs).unref()
  }
  return {
    spawn(o) {
      const c = deps.spawn(o.command, withPrefixArgs(launch, o.args), {
        cwd: o.cwd,
        env: definedEnv(o.env),
        stdio: [...STDIO],
      })
      child = c
      c.stderr?.on('data', (d: Buffer) => {
        tail = (tail + d.toString()).slice(-STDERR_TAIL_BYTES)
      })
      c.on('exit', (code, signal) => {
        exit = { code, signal }
        settle()
      })
      c.on('error', (e: NodeJS.ErrnoException) => {
        error = e
        if (c.pid === undefined) settle()
      })
      o.signal.addEventListener(ABORT_EVENT, () => kill(), { once: true })
      return c as unknown as SpawnedProcess
    },
    stderrTail: () => tail.trim(),
    exitInfo: () => exit,
    spawnError: () => error,
    exited: () =>
      exit || !child || (error && child.pid === undefined)
        ? Promise.resolve(exit)
        : new Promise((resolve) => waiters.push(resolve)),
    kill,
  }
}
