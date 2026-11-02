import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentStatusEvent, StatusSessionMonitor } from '@pragma/module-agent-status/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaudeInterruptMonitor, type MonitorClock } from '../src/main/status/interrupt-monitor'
import { parseClaudeHookEvent } from '../src/main/status/parse-event'
import { type TranscriptFs, TranscriptTail } from '../src/main/status/transcript-tail'
import { createClaudeStatusCapability } from '../src/main/status.capability'

const PATH = '/t/session.jsonl'
const OTHER = '/t/cleared.jsonl'
const POLL = 1000
const SETTLE = 2000

const line = (entry: unknown): string => `${JSON.stringify(entry)}\n`
const user = (content: unknown, extra: object = {}) =>
  line({ type: 'user', message: { role: 'user', content }, ...extra })
const assistant = (content: unknown[], extra: object = {}) =>
  line({ type: 'assistant', message: { role: 'assistant', content }, ...extra })
const L = {
  prompt: user('Fix the login bug'),
  marker: user([{ type: 'text', text: '[Request interrupted by user]' }]),
  toolMarker: user([{ type: 'text', text: '[Request interrupted by user for tool use]' }]),
  stringMarker: user('[Request interrupted by user]'),
  sidechainMarker: user([{ type: 'text', text: '[Request interrupted by user]' }], { isSidechain: true }),
  quotedMarker: assistant([{ type: 'text', text: 'I saw [Request interrupted by user] earlier' }]),
  answer: assistant([{ type: 'text', text: 'Looking at the code…' }]),
  toolUse: assistant([{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }]),
  thinking: assistant([{ type: 'thinking', thinking: 'hmm' }]),
  blank: assistant([{ type: 'text', text: '  ' }]),
  sidechainAnswer: assistant([{ type: 'text', text: 'sub' }], { isSidechain: true }),
}

/** In-memory transcripts; `size`/`read` like the node implementation. */
function memoryFs() {
  const files = new Map<string, Buffer>()
  const fs: TranscriptFs & { sizeCalls: number } = {
    sizeCalls: 0,
    async size(path) {
      fs.sizeCalls++
      return files.get(path)?.length ?? null
    },
    async read(path, start, length) {
      return (files.get(path) ?? Buffer.alloc(0)).subarray(start, start + length)
    },
  }
  const append = (path: string, text: string) =>
    files.set(path, Buffer.concat([files.get(path) ?? Buffer.alloc(0), Buffer.from(text)]))
  return { fs, files, append }
}

describe('TranscriptTail', () => {
  it('reports only lines after its start; a partial last line waits for its newline', async () => {
    const { fs, append } = memoryFs()
    append(PATH, L.marker + L.answer)
    const tail = await TranscriptTail.at(fs, PATH)
    expect(await tail.scan()).toEqual({ interrupted: false, progressed: false })
    append(PATH, L.prompt + L.marker.slice(0, 20))
    expect(await tail.scan()).toEqual({ interrupted: false, progressed: false })
    append(PATH, L.marker.slice(20))
    expect(await tail.scan()).toEqual({ interrupted: true, progressed: false })
    expect(await tail.scan()).toEqual({ interrupted: false, progressed: false })
  })

  it.each([
    ['text block marker', L.marker, true],
    ['tool-use marker', L.toolMarker, true],
    ['string content marker', L.stringMarker, true],
    ['subagent (sidechain) marker', L.sidechainMarker, false],
    ['marker text quoted by the assistant', L.quotedMarker, false],
    ['the prompt', L.prompt, false],
    ['broken JSON with the marker', '{"type":"user" [Request interrupted by user]\n', false],
  ])('interrupt: %s → %s', async (_name, text, interrupted) => {
    const { fs, append } = memoryFs()
    const tail = await TranscriptTail.at(fs, PATH)
    append(PATH, text)
    expect((await tail.scan()).interrupted).toBe(interrupted)
  })

  it.each([
    ['assistant text', L.answer, true],
    ['tool call', L.toolUse, true],
    ['thinking only', L.thinking, false],
    ['blank text', L.blank, false],
    ['subagent text', L.sidechainAnswer, false],
    ['user prompt', L.prompt, false],
  ])('progress: %s → %s', async (_name, text, progressed) => {
    const { fs, append } = memoryFs()
    const tail = await TranscriptTail.at(fs, PATH)
    append(PATH, text)
    expect((await tail.scan()).progressed).toBe(progressed)
  })

  it('a missing transcript starts at 0; a shrunk one restarts at its new end', async () => {
    const { fs, files, append } = memoryFs()
    const tail = await TranscriptTail.at(fs, PATH)
    append(PATH, L.marker)
    expect((await tail.scan()).interrupted).toBe(true)
    files.set(PATH, Buffer.from(L.prompt))
    expect(await tail.scan()).toEqual({ interrupted: false, progressed: false })
    append(PATH, L.marker)
    expect((await tail.scan()).interrupted).toBe(true)
  })

  it('reads at most maxBytes (the newest); skipped bytes count as progress and the cut line is dropped', async () => {
    const { fs, append } = memoryFs()
    const tail = await TranscriptTail.at(fs, PATH, L.marker.length + 10)
    append(PATH, L.prompt + L.prompt + L.marker)
    expect(await tail.scan()).toEqual({ interrupted: true, progressed: true })
    append(PATH, user('x'.repeat(200)).slice(0, 150))
    expect(await tail.scan()).toEqual({ interrupted: false, progressed: true })
    append(PATH, `${'x'.repeat(60)}"}}\n${L.marker}`)
    expect((await tail.scan()).interrupted).toBe(true)
  })
})

describe('ClaudeInterruptMonitor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const clock: MonitorClock = {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  }

  function setup() {
    const mem = memoryFs()
    const reported: AgentStatusEvent[] = []
    const monitor = new ClaudeInterruptMonitor(
      { report: (e) => void reported.push(e) },
      { fs: mem.fs, clock, timings: { pollMs: POLL, settleMs: SETTLE } },
    )
    const hook = (hook_event_name: string, extra: Record<string, string> = {}) => {
      const raw = { hook_event_name, session_id: 'cs1', transcript_path: PATH, ...extra }
      monitor.onHookEvent(raw, parseClaudeHookEvent(raw))
    }
    const tick = (ms = POLL) => vi.advanceTimersByTimeAsync(ms)
    return { ...mem, reported, monitor, hook, tick, write: (text: string) => mem.append(PATH, text) }
  }

  it('Esc during a turn: the marker Claude writes ends it once (no Stop hook), then polling stops', async () => {
    const m = setup()
    m.write(L.marker)
    m.hook('UserPromptSubmit')
    await m.tick()
    m.write(L.prompt + L.answer)
    await m.tick()
    expect(m.reported).toEqual([])
    m.write(L.marker)
    await m.tick()
    expect(m.reported).toEqual([{ kind: 'turnInterrupted' }])
    const calls = m.fs.sizeCalls
    await m.tick(POLL * 5)
    expect(m.fs.sizeCalls).toBe(calls)
    expect(m.reported).toHaveLength(1)
  })

  it('Esc on a permission prompt (waiting): the tool-use marker ends the turn', async () => {
    const m = setup()
    m.hook('UserPromptSubmit')
    m.hook('PreToolUse', { tool_name: 'Bash' })
    m.hook('PermissionRequest')
    await m.tick()
    m.write(L.toolUse + L.toolMarker)
    await m.tick()
    expect(m.reported).toEqual([{ kind: 'turnInterrupted' }])
  })

  it('a normal turn end (Stop) stops polling; a later marker is not reported', async () => {
    const m = setup()
    m.hook('UserPromptSubmit')
    await m.tick()
    m.hook('Stop')
    const calls = m.fs.sizeCalls
    m.write(L.marker)
    await m.tick(POLL * 3)
    expect(m.fs.sizeCalls).toBe(calls)
    expect(m.reported).toEqual([])
  })

  it("Esc before the model answered (Claude puts the prompt back, maybe without a marker): idle once it's quiet", async () => {
    const m = setup()
    m.hook('UserPromptSubmit')
    m.write(L.prompt + L.thinking)
    await m.tick()
    m.monitor.onOutput?.()
    m.monitor.onInterruptKey?.()
    await m.tick(SETTLE - POLL)
    expect(m.reported).toEqual([])
    await m.tick(POLL)
    expect(m.reported).toEqual([{ kind: 'turnInterrupted' }])
  })

  it('a quiet terminal with no answer is not enough without Esc/Ctrl-C (long thinking)', async () => {
    const m = setup()
    m.hook('UserPromptSubmit')
    m.write(L.prompt)
    await m.tick(SETTLE * 5)
    expect(m.reported).toEqual([])
  })

  it.each<[string, (m: ReturnType<typeof setup>) => void]>([
    ['the terminal keeps printing (spinner: Claude still works)', (m) => m.monitor.onOutput?.()],
    ['the model already answered (Claude would have written a marker)', (m) => m.write(L.answer)],
    ['a hook event followed the key', (m) => m.hook('PreToolUse', { tool_name: 'Read' })],
  ])('Esc fallback does not end the turn when %s', async (_name, step) => {
    const m = setup()
    m.hook('UserPromptSubmit')
    m.monitor.onInterruptKey?.()
    for (let i = 0; i < 6; i++) {
      step(m)
      await m.tick()
    }
    expect(m.reported).toEqual([])
  })

  it('a key while waiting (permission prompt is static) or idle never ends anything by itself', async () => {
    const m = setup()
    m.monitor.onInterruptKey?.()
    m.hook('UserPromptSubmit')
    m.hook('PermissionRequest')
    m.monitor.onInterruptKey?.()
    await m.tick(SETTLE * 3)
    expect(m.reported).toEqual([])
  })

  it('without a transcript path nothing is polled or reported', async () => {
    const m = setup()
    const raw = { hook_event_name: 'UserPromptSubmit', session_id: 'cs1' }
    m.monitor.onHookEvent(raw, parseClaudeHookEvent(raw))
    m.monitor.onInterruptKey?.()
    await m.tick(SETTLE * 3)
    expect(m.fs.sizeCalls).toBe(0)
    expect(m.reported).toEqual([])
  })

  it('follows the transcript of the latest hook payload (/clear starts a new file)', async () => {
    const m = setup()
    m.hook('SessionStart', { source: 'clear', transcript_path: OTHER })
    m.hook('UserPromptSubmit', { transcript_path: OTHER })
    m.write(L.marker)
    await m.tick()
    expect(m.reported).toEqual([])
    m.append(OTHER, L.marker)
    await m.tick()
    expect(m.reported).toEqual([{ kind: 'turnInterrupted' }])
  })

  it('dispose stops polling and reporting', async () => {
    const m = setup()
    m.hook('UserPromptSubmit')
    m.monitor.dispose()
    m.write(L.marker)
    m.hook('UserPromptSubmit')
    await m.tick(POLL * 3)
    expect(m.fs.sizeCalls).toBe(1)
    expect(m.reported).toEqual([])
  })
})

describe('claude status capability monitorSession', () => {
  const dirs: string[] = []
  afterEach(async () => {
    for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true })
  })

  it('reads the real transcript file and reports the interrupt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pragma-claude-interrupt-'))
    dirs.push(dir)
    const transcript = join(dir, 'cs1.jsonl')
    await writeFile(transcript, L.prompt)
    const cap = createClaudeStatusCapability({
      hookScriptPath: '/h.mjs',
      execPath: '/node',
      platform: 'darwin',
      chmod: async () => undefined,
      monitor: { timings: { pollMs: 10, settleMs: 50 } },
    })
    const reported: AgentStatusEvent[] = []
    const monitor = cap.monitorSession?.({ report: (e) => void reported.push(e) }) as StatusSessionMonitor
    const raw = { hook_event_name: 'UserPromptSubmit', session_id: 'cs1', transcript_path: transcript }
    monitor.onHookEvent(raw, cap.parseEvent(raw))
    await new Promise((r) => setTimeout(r, 30))
    await appendFile(transcript, L.marker)
    await vi.waitFor(() => expect(reported).toEqual([{ kind: 'turnInterrupted' }]))
    monitor.dispose()
  })
})
