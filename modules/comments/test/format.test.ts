import { describe, expect, it, test } from 'vitest'
import { formatComments, formatThread, formatThreads, languageFromPath } from '../src/main/format'
import { aReply, aThread } from '../src/testing'
import { makeBrowserInput, makeElement, makeInput } from './factories'

const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n')

describe('formatComments', () => {
  test('formats code comments exactly', () => {
    expect(
      formatComments([
        makeInput({
          source: 'diff',
          filePath: 'src/foo.ts',
          lineStart: 42,
          lineEnd: 45,
          snippet: 'const a = 1\nconst b = 2',
          language: 'ts',
          body: 'Rename these.',
        }),
        makeInput({
          source: 'editor',
          filePath: 'README.md',
          lineStart: 3,
          lineEnd: 3,
          snippet: '# Title',
          language: undefined,
          body: 'Typo.\nSecond line.',
        }),
      ]),
    ).toBe(
      [
        'Review comments:',
        '1. `src/foo.ts:42-45`',
        '   ```ts',
        '   const a = 1',
        '   const b = 2',
        '   ```',
        '   Rename these.',
        '',
        '2. `README.md:3`',
        '   ```markdown',
        '   # Title',
        '   ```',
        '   Typo.',
        '   Second line.',
      ].join('\n'),
    )
  })

  test('formats a browser comment exactly', () => {
    expect(
      formatComments([
        makeBrowserInput({
          body: 'Make it blue.',
          element: {
            url: 'http://localhost:5173/login',
            selector: 'form > button.primary',
            outerHtml: '<button class="primary">Sign in</button>',
            text: 'Sign in',
            boundingBox: { x: 10.4, y: 20, width: 100, height: 30.6 },
            screenshotPath: '/tmp/shots/c1.png',
            consoleErrors: ['TypeError: x is undefined'],
            component: { name: 'SubmitButton', source: 'src/Button.tsx:12' },
          },
        }),
      ]),
    ).toBe(
      [
        'Review comments:',
        '1. Browser element `form > button.primary` on http://localhost:5173/login',
        '   - React component: `SubmitButton` (src/Button.tsx:12)',
        '   - Bounding box: x=10, y=20, width=100, height=31',
        '   - Screenshot: /tmp/shots/c1.png',
        '   - Text: "Sign in"',
        '   - outerHTML:',
        '     ```html',
        '     <button class="primary">Sign in</button>',
        '     ```',
        '   - Console errors:',
        '     - TypeError: x is undefined',
        '   Make it blue.',
      ].join('\n'),
    )
  })

  it.each([
    [
      'a 45-line snippet',
      makeInput({ snippet: lines(45) }),
      ['line 40', '(snippet truncated: 5 more lines)'],
      ['line 41'],
    ],
    [
      'a snippet over 4000 chars',
      makeInput({ snippet: 'x'.repeat(4500) }),
      ['(snippet truncated: 500 more characters)'],
      [],
    ],
    [
      '5000 chars of outerHTML',
      makeBrowserInput({ element: makeElement({ outerHtml: 'h'.repeat(5000) }) }),
      ['(outerHTML truncated: showing 2000 of 5000 characters)'],
      [],
    ],
    ['a snippet containing ```', makeInput({ snippet: 'a\n```\nb' }), ['   ````ts\n'], []],
    ["diffSide: 'old'", makeInput({ diffSide: 'old' }), ['1. `src/example.ts:1-2` (old version)'], []],
    [
      '12 console errors',
      makeBrowserInput({ element: makeElement({ consoleErrors: Array.from({ length: 12 }, (_, i) => `e${i}`) }) }),
      ['     - e9\n     - (2 more)'],
      ['e10'],
    ],
    ['no snippet', makeInput({ snippet: undefined }), ['1. `src/example.ts:1-2`\n   Rename these.'], ['```']],
    ['no lines', makeInput({ lineStart: undefined, lineEnd: undefined }), ['1. `src/example.ts`\n'], []],
    [
      'a long element text and styles',
      makeBrowserInput({ element: makeElement({ text: 't'.repeat(250), styles: { color: 'red', margin: '0' } }) }),
      [`   - Text: "${'t'.repeat(200)}…"`, '   - Styles: color: red; margin: 0'],
      [],
    ],
    [
      'a component without source',
      makeBrowserInput({ element: makeElement({ component: { name: 'App' } }) }),
      ['   - React component: `App`\n'],
      [],
    ],
  ])('%s', (_name, input, mustContain, mustNotContain) => {
    const out = formatComments([input])
    for (const s of mustContain) expect(out).toContain(s)
    for (const s of mustNotContain) expect(out).not.toContain(s)
  })

  test('no trailing newline and no trailing spaces', () => {
    const out = formatComments([makeInput({ body: 'a\n\nb\n' }), makeBrowserInput()])
    expect(out.endsWith('\n')).toBe(false)
    expect(out.split('\n').filter((l) => /\s$/.test(l))).toEqual([])
  })
})

it.each([
  ['x.tsx', 'tsx'],
  ['a.md', 'markdown'],
  ['lib/x.MJS', 'js'],
  ['h.hpp', 'cpp'],
  ['Makefile', undefined],
  [undefined, undefined],
])('languageFromPath(%s) = %s', (path, lang) => expect(languageFromPath(path)).toBe(lang))

describe('formatThread', () => {
  const thread = aThread({
    id: 't1',
    filePath: 'src/a.ts',
    lineStart: 3,
    lineEnd: 5,
    diffSide: 'old',
    snippet: 'x()',
    body: 'Why?\nExplain.',
    round: 1,
    replies: [
      aReply({ author: 'agent', authorLabel: 'Claude', body: 'Because.', round: 1 }),
      aReply({ author: 'agent', body: 'Also.', round: 1 }),
      aReply({ author: 'user', body: 'Not convinced.', round: 2 }),
    ],
  })

  test('header, snippet, root and replies in order; new items of the round are marked', () => {
    expect(formatThread(thread, { round: 2 })).toBe(
      [
        '[open] t1 `src/a.ts:3-5` (diff, old version)',
        '   ```ts',
        '   x()',
        '   ```',
        '   User: Why?',
        '     Explain.',
        '   Claude: Because.',
        '   Agent: Also.',
        '   User (new in round 2): Not convinced.',
      ].join('\n'),
    )
  })

  test('the root is marked new in its own round; resolved status and browser source in the header', () => {
    const out = formatThread(
      aThread({ ...makeBrowserInput(), id: 't2', status: 'resolved', round: 3, body: 'Blue.' }),
      { round: 3 },
    )
    expect(out.split('\n')[0]).toBe('[resolved] t2 Browser element `button` on http://localhost:5173/ (browser)')
    expect(out).toContain('   User (new in round 3): Blue.')
  })

  test('formatThreads separates threads with a blank line', () => {
    const a = aThread({ id: 'a', round: 1 })
    const b = aThread({ id: 'b', round: 1 })
    expect(formatThreads([a, b], { round: 1 })).toBe(
      `${formatThread(a, { round: 1 })}\n\n${formatThread(b, { round: 1 })}`,
    )
  })
})
