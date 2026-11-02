#!/usr/bin/env node
// Fake Claude Code for status tests: runs the command hooks of `--settings <file>` like Claude does.
// stdin lines: `hook <Event> [notification_type] [tool_name] [field=value…]`, `session <id>` (like /clear),
// `transcript <prompt|answer|interrupt|interrupt-tool>` (append that entry to the session transcript, no hook),
// `say <text>`, `exit`. Control characters typed into the terminal (Esc) are dropped; Ctrl-C does not end it.
// The session id comes from $FAKE_CLAUDE_SESSION_ID (default "fake-claude-session"). Logs argv to $FAKE_AGENT_LOG.
import { spawn } from 'node:child_process'
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const argv = process.argv.slice(2)
const LOG = process.env.FAKE_AGENT_LOG
if (LOG) appendFileSync(LOG, `${JSON.stringify({ type: 'start', argv, cwd: process.cwd(), ts: Date.now() })}\n`)
let sessionId = process.env.FAKE_CLAUDE_SESSION_ID || 'fake-claude-session'
const transcriptDir = mkdtempSync(join(tmpdir(), 'fake-claude-transcripts-'))
const transcriptPath = () => join(transcriptDir, `${sessionId}.jsonl`)

const at = argv.indexOf('--settings')
const settings = at >= 0 ? JSON.parse(readFileSync(argv[at + 1], 'utf8')) : { hooks: {} }

// Claude reads the terminal in raw mode: Ctrl-C interrupts a turn instead of ending the process.
process.on('SIGINT', () => undefined)

const text = (t) => [{ type: 'text', text: t }]
/** Transcript entries shaped like Claude Code's JSONL (only the fields the app looks at). */
const ENTRIES = {
  prompt: () => ({ type: 'user', message: { role: 'user', content: 'Fix the login bug' } }),
  answer: () => ({ type: 'assistant', message: { role: 'assistant', content: text('Looking at it.') } }),
  interrupt: () => ({ type: 'user', message: { role: 'user', content: text('[Request interrupted by user]') } }),
  'interrupt-tool': () => ({
    type: 'user',
    message: { role: 'user', content: text('[Request interrupted by user for tool use]') },
  }),
}

function runCommand(command, input) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true, stdio: ['pipe', 'ignore', 'inherit'] })
    child.on('close', resolve)
    child.on('error', resolve)
    child.stdin.end(JSON.stringify(input))
  })
}

async function runHooks(event, extra = {}) {
  const input = {
    hook_event_name: event,
    session_id: sessionId,
    transcript_path: transcriptPath(),
    cwd: process.cwd(),
    ...extra,
  }
  for (const entry of settings.hooks?.[event] ?? [])
    for (const h of entry.hooks ?? []) await runCommand(h.command, input)
}

const queue = []
let busy = false
async function drain() {
  if (busy) return
  busy = true
  while (queue.length > 0) await queue.shift()()
  busy = false
}
const enqueue = (fn) => {
  queue.push(fn)
  void drain()
}

async function onLine(raw) {
  const [cmd, ...rest] = raw
    .replace(/\p{Cc}/gu, '')
    .trim()
    .split(' ')
  if (cmd === 'hook') {
    const fields = Object.fromEntries(rest.filter((r) => r.includes('=')).map((r) => r.split('=', 2)))
    const [event, notification_type, tool_name] = rest.filter((r) => !r.includes('='))
    await runHooks(event, {
      ...(notification_type ? { notification_type } : {}),
      ...(tool_name ? { tool_name } : {}),
      ...fields,
    })
    process.stdout.write(`hooked ${event}\r\n`)
  } else if (cmd === 'transcript' && ENTRIES[rest[0]]) {
    appendFileSync(transcriptPath(), `${JSON.stringify(ENTRIES[rest[0]]())}\n`)
    process.stdout.write(`wrote ${rest[0]}\r\n`)
  } else if (cmd === 'session') sessionId = rest[0]
  else if (cmd === 'say') process.stdout.write(`${rest.join(' ')}\r\n`)
  else if (cmd === 'exit') {
    await runHooks('SessionEnd', { reason: 'exit' })
    process.exit(0)
  }
}

enqueue(() => runHooks('SessionStart', { source: 'startup' }))
process.stdout.write('fake-claude ready\r\n')
createInterface({ input: process.stdin }).on('line', (l) => enqueue(() => onLine(l)))
