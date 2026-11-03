import { describe, expect, it, test } from 'vitest'
import type { Comment, CommentInput } from '../src/contract'
import { formatNudge, formatThread, formatThreads, languageFromPath } from '../src/main/format'
import { aReply, aThread } from '../src/testing'
import { makeBrowserInput, makeElement, makeInput } from './factories'

/** Threads `t1`, `t2`, … from composer inputs, rendered with nothing new in the round. */
const formatComments = (inputs: CommentInput[]) =>
  formatThreads(
    inputs.map((input, i) => aThread({ ...(input as Partial<Comment>), id: `t${i + 1}` })),
    { round: 0 },
  )
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n')

describe('thread rendering', () => {
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
        '[open] t1 `src/foo.ts:42-45` (diff)',
        '   ```ts',
        '   const a = 1',
        '   const b = 2',
        '   ```',
        '   User: Rename these.',
        '',
        '[open] t2 `README.md:3` (editor)',
        '   ```markdown',
        '   # Title',
        '   ```',
        '   User: Typo.',
        '     Second line.',
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
        '[open] t1 Browser element `form > button.primary` on http://localhost:5173/login (browser)',
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
        '   User: Make it blue.',
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
    ["diffSide: 'old'", makeInput({ diffSide: 'old' }), ['[open] t1 `src/example.ts:1-2` (diff, old version)'], []],
    [
      '12 console errors',
      makeBrowserInput({ element: makeElement({ consoleErrors: Array.from({ length: 12 }, (_, i) => `e${i}`) }) }),
      ['     - e9\n     - (2 more)'],
      ['e10'],
    ],
    [
      'no snippet',
      makeInput({ snippet: undefined }),
      ['[open] t1 `src/example.ts:1-2` (diff)\n   User: Rename these.'],
      ['```'],
    ],
    ['no lines', makeInput({ lineStart: undefined, lineEnd: undefined }), ['[open] t1 `src/example.ts` (diff)\n'], []],
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

describe('formatNudge', () => {
  const tail =
    ' Address them with the pragma-review skill: read them with `pragma comments list`, make the requested changes,' +
    ' resolve each done thread with `pragma comments resolve <id>` and reply with' +
    ' `pragma comments reply <id> --body "<text>"` only to ask or answer a question.'
  it.each([
    [
      { round: 2, open: 3, created: 1, updated: 2 },
      'Review round 2: 3 open review threads in this worktree (1 new, 2 with new replies).',
    ],
    [{ round: 1, open: 1, created: 1, updated: 0 }, 'Review round 1: 1 open review thread in this worktree (1 new).'],
    [
      { round: 4, open: 5, created: 0, updated: 1 },
      'Review round 4: 5 open review threads in this worktree (1 with new replies).',
    ],
  ])('%j', (counts, head) => {
    const text = formatNudge(counts)
    expect(text).toBe(head + tail)
    expect(text).not.toContain('\n')
    expect(text).toContain('pragma-review')
  })
})
