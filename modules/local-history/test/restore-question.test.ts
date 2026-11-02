import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { EntrySummary } from '../src/contract'
import { restoreQuestion } from '../src/renderer/restore'

const EN = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'locales', 'en.json'), 'utf8'))
const entry = (over: Partial<EntrySummary>): EntrySummary => ({
  id: 1,
  worktreeId: 'w',
  cwd: '/r',
  reason: 'discard',
  createdAt: 0,
  restoredAt: null,
  headSha: null,
  fileCount: 0,
  stashCount: 0,
  ...over,
})
/** The English sentence a key resolves to (i18next plural suffixes, `{{x}}` params). */
function text(q: ReturnType<typeof restoreQuestion>): string {
  const path = q.messageKey.replace('local-history:', '').split('.')
  const params = (q.params ?? {}) as Record<string, string | number>
  const node = path.reduce((o: Record<string, unknown>, k) => o[k] as Record<string, unknown>, EN)
  const leaf = path.at(-1) as string
  const parent = path.slice(0, -1).reduce((o: Record<string, unknown>, k) => o[k] as Record<string, unknown>, EN)
  const raw = typeof node === 'string' ? node : (parent[`${leaf}_${params.count === 1 ? 'one' : 'other'}`] as string)
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k]))
}

describe('restoreQuestion: each kind of entry says what restoring it does', () => {
  it('one file', () => {
    const q = restoreQuestion(entry({ fileCount: 3 }), ['src/app.ts'])
    expect(text(q)).toBe(
      'Restore src/app.ts to the saved version? Its current content is saved to Local History first, so you can undo this.',
    )
    expect(q.confirmKey).toBe('local-history:confirm.restoreConfirm')
  })

  it('several files', () => {
    expect(text(restoreQuestion(entry({ fileCount: 3 })))).toMatch(/^Restore 3 files to the saved version\?/)
    expect(text(restoreQuestion(entry({ fileCount: 1 })))).toMatch(/^Restore 1 file to the saved version\?/)
  })

  it('a dropped stash goes back on the list, files untouched', () => {
    const q = restoreQuestion(entry({ reason: 'stashDrop', stashCount: 1 }))
    expect(text(q)).toBe(
      'Put the dropped stash back on the stash list? Your files are not changed; apply or pop it from Git Changes.',
    )
    expect(q.confirmKey).toBe('local-history:confirm.stashConfirm')
    expect(text(restoreQuestion(entry({ reason: 'stashClear', stashCount: 2 })))).toMatch(/^Put the 2 dropped stashes/)
  })

  it('an undone commit is redone, files untouched', () => {
    const q = restoreQuestion(entry({ reason: 'undoCommit', headSha: 'abcdef1234567' }))
    expect(text(q)).toBe(
      'Redo the undone commit abcdef1? This only works while nothing was committed after it. Your files are not changed.',
    )
    expect(q.confirmKey).toBe('local-history:confirm.commitConfirm')
  })
})
