import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { MAX_PANES_PER_TAB, TerminalTabSchema } from '../src/contract'
import { pane, tab } from './support/factories'

const CONTRACT_DIR = join(import.meta.dirname, '..', 'src', 'contract')
const NODE_ONLY_IMPORT = /from '(node:[^']+|fs|child_process|path|electron|node-pty)'/

test('contract is renderer-safe', () => {
  const offenders = readdirSync(CONTRACT_DIR).filter((f) =>
    NODE_ONLY_IMPORT.test(readFileSync(join(CONTRACT_DIR, f), 'utf8')),
  )
  expect(offenders).toEqual([])
})

const panes = (count: number) => Array.from({ length: count }, () => pane())

test('layout schema accepts up to MAX_PANES_PER_TAB panes per tab', () => {
  expect(TerminalTabSchema.safeParse(tab({ panes: panes(MAX_PANES_PER_TAB) })).success).toBe(true)
  expect(TerminalTabSchema.safeParse(tab({ panes: panes(MAX_PANES_PER_TAB + 1) })).success).toBe(false)
})
