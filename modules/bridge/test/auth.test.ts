import { describe, expect, it } from 'vitest'
import { bearerFrom, generateToken, isAllowedHost, isAllowedOrigin, tokensEqual } from '../src/main/auth'

const PORT = 4567

describe('bridge auth', () => {
  it('token is 43 base64url chars and unique', () => {
    const a = generateToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateToken()).not.toBe(a)
  })

  it.each([
    ['abc', 'abc', true],
    ['abc', 'abcd', false],
    ['abc', 'abd', false],
    ['abc', undefined, false],
    ['abc', null, false],
    ['abc', '', false],
  ])('tokensEqual(%s, %s) → %s', (expected, given, ok) => {
    expect(tokensEqual(expected, given)).toBe(ok)
  })

  it.each([
    ['Bearer abc', 'abc'],
    ['bearer abc', 'abc'],
    ['Basic x', null],
    [undefined, null],
    [['Bearer a', 'Bearer b'], null],
    ['Bearer ', null],
  ])('bearerFrom(%j) → %s', (header, token) => {
    expect(bearerFrom(header)).toBe(token)
  })

  it.each([
    [`127.0.0.1:${PORT}`, true],
    [`localhost:${PORT}`, true],
    [`evil.com:${PORT}`, false],
    ['127.0.0.1:1', false],
    [undefined, false],
  ])('isAllowedHost(%s) → %s', (host, ok) => {
    expect(isAllowedHost(host, PORT)).toBe(ok)
  })

  it.each([
    [undefined, true],
    ['null', true],
    ['https://evil.com', false],
    ['http://127.0.0.1:1', false],
  ])('isAllowedOrigin(%s) → %s', (origin, ok) => {
    expect(isAllowedOrigin(origin)).toBe(ok)
  })
})
