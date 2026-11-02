import { EventEmitter } from 'node:events'
import type { SpawnOptions } from '@anthropic-ai/claude-agent-sdk'
import { describe, expect, it } from 'vitest'
import { createClaudeProcessSpawn, type SpawnDeps } from '../../src/main/chat/spawn'

const GRACE_MS = 300
const TERM_EXIT_MS = 200
const BEFORE_EXIT_MS = 100
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A spawned fake child: exits `termExitMs` after SIGTERM (never when null) and at once on SIGKILL. */
function spawnerWithChild(termExitMs: number | null) {
  const signals: string[] = []
  const child = Object.assign(new EventEmitter(), {
    stderr: new EventEmitter(),
    pid: 1,
    kill(signal: string) {
      signals.push(signal)
      if (signal === 'SIGKILL') setImmediate(() => child.emit('exit', null, 'SIGKILL'))
      else if (termExitMs !== null) setTimeout(() => child.emit('exit', 0, null), termExitMs)
      return true
    },
  })
  const deps: SpawnDeps = { spawn: (() => child) as unknown as SpawnDeps['spawn'], killGraceMs: GRACE_MS }
  const spawner = createClaudeProcessSpawn({ command: 'claude', prefixArgs: [] }, deps)
  const abort = new AbortController()
  spawner.spawn({ command: 'claude', args: [], env: {}, signal: abort.signal } as unknown as SpawnOptions)
  /** What `query.close()` does: abort → SIGTERM; then the session awaits `stop()`. */
  const close = () => {
    abort.abort()
    return spawner.stop()
  }
  return { close, signals }
}

function track(p: Promise<unknown>) {
  let done = false
  void p.then(() => {
    done = true
  })
  return () => done
}

describe('claude chat close waits for the process (11c)', () => {
  it('close resolves only after the child exits', async () => {
    const { close, signals } = spawnerWithChild(TERM_EXIT_MS)
    const isDone = track(close())
    await sleep(BEFORE_EXIT_MS)
    expect(isDone()).toBe(false)
    await sleep(TERM_EXIT_MS)
    expect(isDone()).toBe(true)
    expect(signals).toEqual(['SIGTERM'])
  })

  it('kills after the grace and still waits for the exit', async () => {
    const { close, signals } = spawnerWithChild(null)
    const stopped = close()
    const isDone = track(stopped)
    await sleep(BEFORE_EXIT_MS)
    expect(isDone()).toBe(false)
    expect(await stopped).toEqual({ code: null, signal: 'SIGKILL' })
    expect(signals[0]).toBe('SIGTERM')
    expect(signals).toContain('SIGKILL')
  })
})
