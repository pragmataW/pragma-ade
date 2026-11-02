import type { CapabilityMap } from '@pragma/sdk'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { isSafeExternalSessionId, type ResumeCapability, switchResultSchema, switchTargetSchema } from '../src/contract'

describe('chat-switch contract', () => {
  it.each([
    ['3f2c9a1e-8d4b-4c1a-9f00-1234567890ab', true],
    ['ses_8a1b2c3d4e', true],
    ['', false],
    ['-p', false],
    ['a b', false],
    ['x'.repeat(201), false],
  ])('isSafeExternalSessionId(%j) = %s', (id, ok) => expect(isSafeExternalSessionId(id)).toBe(ok))

  it('schemas', () => {
    expect(switchResultSchema.safeParse({ ok: true }).success).toBe(false)
    expect(switchTargetSchema.options).toEqual(['terminal', 'chat'])
  })

  it('ResumeCapability merged', () => expectTypeOf<CapabilityMap['resume']>().toEqualTypeOf<ResumeCapability>())
})
