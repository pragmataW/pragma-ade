import { describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH } from '../src/constants'
import { formatGreeting } from '../src/lib/greeting'

describe('formatGreeting', () => {
  it.each([
    ['Ada', 'Ada'],
    ['  Ada  ', 'Ada'],
    ['', 'World'],
    [undefined, 'World'],
    ['x'.repeat(MAX_NAME_LENGTH + 5), 'x'.repeat(MAX_NAME_LENGTH)],
  ])('%j → %j', (input, expected) => expect(formatGreeting(input)).toBe(expected))
})
