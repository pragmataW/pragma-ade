import { expect, it } from 'vitest'
import { parseRawPick, sanitizeUrl } from '../../src/main/picker/payload'
import { browserSettingsDefaults as SETTINGS } from '../../src/main/settings'

const validRaw = () => ({
  url: 'http://localhost:3000/',
  title: 'Home',
  selector: '#b',
  domPath: 'body > button#b',
  tagName: 'button',
  outerHtml: '<button id="b">x</button>',
  text: 'x',
  rect: { x: 1, y: 2, width: 3, height: 4 },
  viewport: { width: 800, height: 600 },
  styles: { display: 'block' },
})

it.each([
  [null],
  [{ url: 'x' }],
  [{ ...validRaw(), rect: { ...validRaw().rect, x: Number.NaN } }],
  [{ ...validRaw(), viewport: { width: Number.POSITIVE_INFINITY, height: 1 } }],
])('rejects %#', (raw) => expect(parseRawPick(raw, SETTINGS)).toBeNull())

it('accepts a valid payload unchanged', () => expect(parseRawPick(validRaw(), SETTINGS)).toEqual(validRaw()))

it('clamps strings and drops unknown style keys', () => {
  const r = parseRawPick(
    { ...validRaw(), outerHtml: 'x'.repeat(1e6), styles: { display: 'flex', evil: 'x' } },
    SETTINGS,
  )
  expect(r?.outerHtml.length).toBeLessThanOrEqual(SETTINGS.outerHtmlMaxChars + 40)
  expect(r?.outerHtml).toMatch(/…\[truncated 998000 chars\]$/)
  expect(r?.styles).toEqual({ display: 'flex' })
})

it('redacts sensitive query params', () =>
  expect(sanitizeUrl('http://u:p@localhost:3000/a?token=abc&page=2#x')).toBe(
    'http://localhost:3000/a?token=%5Bredacted%5D&page=2',
  ))

it('leaves unparseable urls alone', () => expect(sanitizeUrl('not a url')).toBe('not a url'))
