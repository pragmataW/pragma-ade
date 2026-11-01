import { describe, expect, it } from 'vitest'
import { type ChatOptionDescriptor, validateOptionValue } from '../../src/contract'

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
