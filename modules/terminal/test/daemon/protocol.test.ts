import { expect, test } from 'vitest'
import { DaemonRequestSchema } from '../../packages/pty-daemon/src/protocol'
import { spec } from '../support/factories'

test('parses a spawn request', () =>
  expect(DaemonRequestSchema.parse({ id: 1, type: 'spawn', spec: spec() }).type).toBe('spawn'))

test.each([{ cols: 0 }, { cols: 1001 }, { rows: 0 }, { cols: 80.5 }])('rejects bad size %o', (bad) =>
  expect(() => DaemonRequestSchema.parse({ id: 1, type: 'resize', ptyId: 'p', cols: 80, rows: 24, ...bad })).toThrow(),
)

test('rejects unknown type', () => expect(() => DaemonRequestSchema.parse({ id: 1, type: 'nope' })).toThrow())
