#!/usr/bin/env node
// Generic fake agent for status tests (no provider knowledge): prints "ready"; stdin lines `say <text>` print the
// text, `exit` exits 0. Logs `{ type: 'start', argv, env }` (PRAGMA_* subset) to $FAKE_AGENT_LOG when set.
import { appendFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const LOG = process.env.FAKE_AGENT_LOG
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('PRAGMA_')))
if (LOG) appendFileSync(LOG, `${JSON.stringify({ type: 'start', argv: process.argv.slice(2), env, ts: Date.now() })}\n`)

process.stdout.write('ready\r\n')
createInterface({ input: process.stdin }).on('line', (raw) => {
  const line = raw.trim()
  if (line === 'exit') process.exit(0)
  if (line.startsWith('say ')) process.stdout.write(`${line.slice(4)}\r\n`)
})
