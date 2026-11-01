#!/usr/bin/env node
// Fake OpenCode 2.x for status tests: requires --standalone (exit 2 otherwise), loads every plugin directory of
// OPENCODE_CONFIG_CONTENT.plugins (`<dir>/index.js`, default `{ id, setup }`) and feeds its event subscription from
// stdin lines `oc <type> <json-data>`. Also `say <text>` and `exit`. Logs argv to $FAKE_AGENT_LOG.
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

const FLUSH_MS = 100
const argv = process.argv.slice(2)
const LOG = process.env.FAKE_AGENT_LOG
if (LOG) appendFileSync(LOG, `${JSON.stringify({ type: 'start', argv, ts: Date.now() })}\n`)
if (!argv.includes('--standalone')) {
  process.stderr.write('fake-opencode: --standalone required\n')
  process.exit(2)
}

const subscribers = new Set()
function subscribe({ signal }) {
  const pending = []
  let wake
  const sub = {
    push(ev) {
      pending.push(ev)
      wake?.()
    },
  }
  subscribers.add(sub)
  signal?.addEventListener('abort', () => {
    subscribers.delete(sub)
    wake?.()
  })
  return (async function* () {
    while (!signal?.aborted) {
      if (pending.length === 0) await new Promise((r) => (wake = r))
      while (pending.length > 0) yield pending.shift()
    }
  })()
}

let plugins = []
try {
  plugins = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT ?? '{}').plugins ?? []
} catch {}
const cleanups = []
for (const dir of plugins) {
  const mod = await import(pathToFileURL(join(dir, 'index.js')).href)
  const cleanup = await mod.default.setup({ event: { subscribe } })
  if (typeof cleanup === 'function') cleanups.push(cleanup)
}

process.stdout.write('fake-opencode ready\r\n')
createInterface({ input: process.stdin }).on('line', async (raw) => {
  const line = raw.trim()
  const [cmd, type] = line.split(' ', 2)
  if (cmd === 'oc') {
    const json = line.slice(cmd.length + type.length + 2)
    const ev = { type, data: json ? JSON.parse(json) : {} }
    for (const s of subscribers) s.push(ev)
    await new Promise((r) => setTimeout(r, FLUSH_MS))
    process.stdout.write(`event ${type}\r\n`)
  } else if (cmd === 'say') process.stdout.write(`${line.slice(4)}\r\n`)
  else if (cmd === 'exit') {
    for (const c of cleanups) c()
    process.exit(0)
  }
})
