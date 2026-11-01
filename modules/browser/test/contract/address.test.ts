import { expect, it } from 'vitest'
import { normalizeAddressInput } from '../../src/contract'
import { SEARCH_URL as S } from '../lib/builders'

it.each([
  ['3000', { kind: 'url', url: 'http://localhost:3000/' }],
  [':5173/app', { kind: 'url', url: 'http://localhost:5173/app' }],
  ['localhost:8080', { kind: 'url', url: 'http://localhost:8080/' }],
  ['127.0.0.1:4000/x?y=1', { kind: 'url', url: 'http://127.0.0.1:4000/x?y=1' }],
  ['[::1]:3000', { kind: 'url', url: 'http://[::1]:3000/' }],
  ['http://example.test', { kind: 'url', url: 'http://example.test/' }],
  ['example.com/docs', { kind: 'url', url: 'https://example.com/docs' }],
  ['example.com:8443/x', { kind: 'url', url: 'https://example.com:8443/x' }],
  ['about:blank', { kind: 'url', url: 'about:blank' }],
  ['react useEffect', { kind: 'search', url: 'https://duckduckgo.com/?q=react%20useEffect' }],
  ['file:///etc/passwd', { kind: 'search', url: 'https://duckduckgo.com/?q=file%3A%2F%2F%2Fetc%2Fpasswd' }],
  ['javascript:alert(1)', { kind: 'search', url: 'https://duckduckgo.com/?q=javascript%3Aalert(1)' }],
  ['   ', null],
])('%s', (input, expected) => expect(normalizeAddressInput(input, S)).toEqual(expected))
