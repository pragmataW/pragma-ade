import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { TerminalTabSchema } from '../src/contract'
import { pane, tab } from './support/factories'

const CONTRACT_DIR = join(import.meta.dirname, '..', 'src', 'contract')
const NODE_ONLY_IMPORT = /from '(node:[^']+|fs|child_process|path|electron|node-pty)'/

test('contract is renderer-safe', () => {
  const offenders = readdirSync(CONTRACT_DIR).filter((f) =>
    NODE_ONLY_IMPORT.test(readFileSync(join(CONTRACT_DIR, f), 'utf8')),
  )
  expect(offenders).toEqual([])
})

test('layout schema rejects a tab with 3 panes', () => {
  expect(TerminalTabSchema.safeParse(tab({ panes: [pane(), pane()] })).success).toBe(true)
  expect(TerminalTabSchema.safeParse(tab({ panes: [pane(), pane(), pane()] })).success).toBe(false)
})
