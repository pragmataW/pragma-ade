import { describe, expect, it } from 'vitest'
import { type ChatOptionDescriptor, nextCycleChoice, validateOptionValue } from '../../src/contract'

const base = { key: 'k', labelKey: 'chat:option.model', default: null, current: null }
const enumOpt: ChatOptionDescriptor = { ...base, type: 'enum', values: [{ value: 'a' }, { value: null }] }
const numOpt: ChatOptionDescriptor = { ...base, type: 'number', min: 1, max: 3 }
const boolOpt: ChatOptionDescriptor = { ...base, type: 'boolean' }

describe('validateOptionValue', () => {
  it.each([
    [enumOpt, 'a', true],
    [enumOpt, null, true],
    [enumOpt, 'b', false],
    [numOpt, 2, true],
    [numOpt, 0, false],
    [numOpt, 4, false],
    [numOpt, '2', false],
    [boolOpt, true, true],
    [boolOpt, 'true', false],
  ])('%o accepts %o: %s', (d, v, ok) => {
    expect(validateOptionValue(d, v)).toBe(ok)
  })
})

describe('nextCycleChoice', () => {
  const modes = (current: string): ChatOptionDescriptor => ({
    ...base,
    type: 'enum',
    current,
    values: [{ value: 'default' }, { value: 'acceptEdits' }, { value: 'plan' }, { value: 'bypass', cycle: false }],
  })
  it.each([
    ['default', 'acceptEdits'],
    ['plan', 'default'],
    ['bypass', 'default'],
  ])('%s → %s (cycle:false skipped, wraps)', (current, next) => {
    expect(nextCycleChoice(modes(current))?.value).toBe(next)
  })

  it('nothing to cycle to', () => {
    expect(nextCycleChoice({ ...base, type: 'enum', current: 'a', values: [{ value: 'a' }] })).toBeUndefined()
  })
})
