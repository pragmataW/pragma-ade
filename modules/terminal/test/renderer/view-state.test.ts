import { expect, test } from 'vitest'
import type { PtyInfo } from '../../src/contract'
import { INITIAL_VIEW_STATE, type ViewAction, viewReducer } from '../../src/renderer/view/view-state'

const info: PtyInfo = {
  ptyId: 'p',
  pid: 1,
  cwd: '/',
  command: '/bin/sh',
  args: [],
  tags: {},
  cols: 80,
  rows: 24,
  status: 'running',
  exitCode: null,
  signal: null,
  createdAt: 0,
  bracketedPaste: false,
}
const exitedInfo: PtyInfo = { ...info, status: 'exited', exitCode: 3 }
const exit = { exitCode: 1, signal: null, reason: 'exited' } as const

test.each<[string, ViewAction, string]>([
  ['attached live info', { type: 'attached', info }, 'live'],
  ['attached exited info', { type: 'attached', info: exitedInfo }, 'exited'],
  ['notFound', { type: 'notFound' }, 'not-found'],
  ['exit while live', { type: 'exit', exit }, 'exited'],
  ['failed', { type: 'failed', message: 'x' }, 'error'],
])('%s → %s', (_name, action, kind) => expect(viewReducer(INITIAL_VIEW_STATE, action).kind).toBe(kind))

test('an exited attach keeps the reported reason', () => {
  const state = viewReducer(INITIAL_VIEW_STATE, {
    type: 'attached',
    info: { ...exitedInfo, exitCode: null },
    exit: { exitCode: null, signal: null, reason: 'daemon-restarted' },
  })
  expect(state).toEqual({ kind: 'exited', exit: { exitCode: null, signal: null, reason: 'daemon-restarted' } })
})

test('attaching to an exited pty derives the exit from its info', () =>
  expect(viewReducer(INITIAL_VIEW_STATE, { type: 'attached', info: exitedInfo })).toEqual({
    kind: 'exited',
    exit: { exitCode: 3, signal: null, reason: 'exited' },
  }))
