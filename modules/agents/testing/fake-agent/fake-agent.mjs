#!/usr/bin/env node
// Fake agent CLI for tests (phase 03): logs argv/cwd/env/stdin as JSONL, echoes a line editor, supports plugins.
// No dependencies. See modules/agents/README.md ("Fake agent").
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const env = process.env
const LOG_FILE = env.FAKE_AGENT_LOG
const argv = process.argv.slice(2)
const ENV_PREFIXES = ['PRAGMA_', 'FAKE_AGENT_']
const CTRL_C = '\x03'
const BACKSPACE = '\x7f'
const SIGNAL_EXIT_CODES = { SIGTERM: 143, SIGHUP: 129 }
const INTERRUPT_EXIT_CODE = 130

const list = (value) => (value ?? '').split(',').filter(Boolean)
const log = (entry) => {
  if (LOG_FILE) appendFileSync(LOG_FILE, `${JSON.stringify({ ...entry, ts: Date.now() })}\n`)
}
const write = (text) => process.stdout.write(text)

function selectedEnv() {
  const extra = new Set(list(env.FAKE_AGENT_ENV_KEYS))
  return Object.fromEntries(
    Object.entries(env).filter(([k]) => extra.has(k) || ENV_PREFIXES.some((p) => k.startsWith(p))),
  )
}

if (argv.length === 1 && argv[0] === '--version' && env.FAKE_AGENT_VERSION) {
  write(`${env.FAKE_AGENT_VERSION}\n`)
  process.exit(0)
}

let exiting = false
function exit(code, signal = null) {
  if (exiting) return
  exiting = true
  log({ type: 'exit', code, signal })
  process.exit(code)
}

const commands = new Map()
commands.set('exit', (rest) => exit(Number.parseInt(rest, 10) || 0))

log({ type: 'start', pid: process.pid, argv, cwd: process.cwd(), env: selectedEnv() })

for (const path of list(env.FAKE_AGENT_PLUGINS)) {
  const plugin = await import(pathToFileURL(path).href)
  plugin.default({ env, log, write, onCommand: (name, fn) => commands.set(name, fn) })
}

for (const signal of Object.keys(SIGNAL_EXIT_CODES)) process.on(signal, () => exit(SIGNAL_EXIT_CODES[signal], signal))
const exitAfter = Number(env.FAKE_AGENT_EXIT_AFTER_MS)
if (exitAfter > 0) setTimeout(() => exit(0), exitAfter)

write(`fake-agent ready\r\nargs: ${JSON.stringify(argv)}\r\n> `)

function runLine(line) {
  log({ type: 'line', line })
  if (line.startsWith('/')) {
    const [name, ...rest] = line.slice(1).split(' ')
    const fn = commands.get(name)
    if (fn) fn(rest.join(' '))
    else write(`unknown command: ${name}\r\n`)
  }
  if (!exiting) write('> ')
}

let line = ''
let lastWasCr = false
function onChar(ch) {
  const isLf = ch === '\n'
  if (isLf && lastWasCr) {
    lastWasCr = false
    return
  }
  lastWasCr = ch === '\r'
  if (ch === CTRL_C) return exit(INTERRUPT_EXIT_CODE)
  if (lastWasCr || isLf) {
    write('\r\n')
    const done = line
    line = ''
    return runLine(done)
  }
  if (ch === BACKSPACE) {
    if (line.length > 0) write('\b \b')
    line = line.slice(0, -1)
    return
  }
  line += ch
  write(ch)
}

if (process.stdin.isTTY) process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
process.stdin.on('data', (text) => {
  log({ type: 'data', text })
  for (const ch of text) {
    if (exiting) return
    onChar(ch)
  }
})
process.stdin.on('end', () => exit(0))
