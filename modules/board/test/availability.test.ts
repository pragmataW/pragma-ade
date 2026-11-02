import { describe, expect, it } from 'vitest'
import en from '../locales/en.json'
import { BOARD_ERROR_CODES, BoardError } from '../src/contract'
import { isWorktreeGone, sessionAvailability, unavailableHintKey } from '../src/renderer/lib/availability'
import { errorNotice } from '../src/renderer/lib/errors'
import { aLinkedSession } from './support/builders'

const known = new Map([['w1', {}]])

describe('isWorktreeGone', () => {
  it.each([
    ['a listed worktree', 'w1', known, false],
    ['an unlisted worktree', 'w9', known, true],
    ['no worktree', null, known, false],
    ['01 not loaded yet', 'w9', new Map(), false],
  ] as const)('%s', (_name, id, worktrees, gone) => {
    expect(isWorktreeGone(id, worktrees)).toBe(gone)
  })
})

describe('sessionAvailability', () => {
  it.each([
    ['an open session in a listed worktree', {}, 'open'],
    ['an ended session', { ended: true }, 'ended'],
    ['a session whose worktree is gone (ended or not)', { worktreeId: 'w9' }, 'worktreeRemoved'],
    ['an ended session whose worktree is gone', { worktreeId: 'w9', ended: true }, 'worktreeRemoved'],
  ] as const)('%s', (_name, over, availability) => {
    expect(sessionAvailability(aLinkedSession('s1', over), known)).toBe(availability)
  })

  it('only a closed session has a hint', () => {
    expect(unavailableHintKey('open')).toBeNull()
    expect(unavailableHintKey('ended')).toBe('board:sessions.unavailable.ended')
    expect(unavailableHintKey('worktreeRemoved')).toBe('board:sessions.unavailable.worktreeRemoved')
    expect(Object.keys(en.sessions.unavailable).sort()).toEqual(['ended', 'worktreeRemoved'])
  })
})

describe('errorNotice', () => {
  it.each(BOARD_ERROR_CODES)('board error %s maps to its own translated message', (code) => {
    expect(errorNotice(new BoardError(code, 'raw detail'))).toEqual({ messageKey: `board:error.codes.${code}` })
    expect(en.error.codes[code]).toEqual(expect.any(String))
  })

  it('any other error (e.g. projects worktreeNotFound) gets the generic message, never its code', () => {
    expect(errorNotice(new Error('worktreeNotFound: 8f11'))).toEqual({ messageKey: 'board:error.unexpected' })
  })
})
