import { describe, expect, it } from 'vitest'
import { SupportCache } from '../../src/main/support-cache'
import { makeProfile } from '../../testing'

describe('SupportCache', () => {
  it('editing args clears failure', () => {
    const cache = new SupportCache()
    const profile = makeProfile({ args: ['--a'] })
    cache.fail(profile, 'chat:unsupported.noProtocol')
    expect(cache.get(profile)).toEqual({ reasonKey: 'chat:unsupported.noProtocol' })
    expect(cache.get({ ...profile, args: ['--b'] })).toBeUndefined()
    expect(cache.get({ ...profile, command: 'other' })).toBeUndefined()
    cache.clear(profile)
    expect(cache.get(profile)).toBeUndefined()
  })
})
