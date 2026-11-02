import { describe, expect, it } from 'vitest'
import {
  ChangeListSchema,
  fileContentsIpc,
  GIT_CHANGES_CHANNELS,
  GIT_CHANGES_SETTINGS_DEFAULTS,
  GitChangesSettingsSchema,
  GitChangesTestIds,
  RepoPathSchema,
  RevealArgsSchema,
} from '../src/contract'

const testIdValues = Object.values(GitChangesTestIds).map((v) => (typeof v === 'function' ? v('branch') : v))

describe('git-changes contract', () => {
  it.each(['src/a.ts', 'dir with space/ünï "q".txt', '-dash.txt'])('RepoPath accepts %s', (p) => {
    expect(RepoPathSchema.parse(p)).toBe(p)
  })

  it.each(['/etc/passwd', '../x', 'a/../../x', 'a\0b', 'a\\b', ''])('RepoPath rejects %j', (p) => {
    expect(RepoPathSchema.safeParse(p).success).toBe(false)
  })

  it.each([
    {
      state: 'ok',
      worktreeId: 'w',
      mode: 'branch',
      baseBranch: 'main',
      mergeBase: 'abc',
      headSha: 'def',
      commitCount: 2,
      files: [{ path: 'a.ts', status: 'M', additions: 1, deletions: 2, binary: false }],
      totals: { files: 1, additions: 1, deletions: 2 },
    },
    { state: 'baseNotFound', worktreeId: 'w', mode: 'branch', baseBranch: 'nope' },
    { state: 'noMergeBase', worktreeId: 'w', mode: 'branch', baseBranch: 'orphan' },
  ])('ChangeList parses the $state variant', (value) => {
    expect(ChangeListSchema.parse(value)).toEqual(value)
  })

  it('the settings defaults parse', () => {
    expect(GitChangesSettingsSchema.parse(GIT_CHANGES_SETTINGS_DEFAULTS)).toEqual({
      maxFileBytes: 1_048_576,
      viewMode: 'tree',
      diffStyle: 'unified',
      showFullFile: false,
      pullRebase: false,
    })
  })

  it('every test id starts with gc- and is unique', () => {
    for (const v of testIdValues) expect(v.startsWith('gc-')).toBe(true)
    expect(new Set(testIdValues).size).toBe(testIdValues.length)
  })

  it('every IPC channel starts with git-changes.', () => {
    for (const c of Object.values(GIT_CHANGES_CHANNELS)) expect(c.startsWith('git-changes.')).toBe(true)
  })

  it('fileContents and reveal validate paths', () => {
    const base = { worktreeId: 'w', mode: 'uncommitted', status: 'M' }
    expect(fileContentsIpc.input.safeParse({ ...base, path: '../x' }).success).toBe(false)
    expect(RevealArgsSchema.safeParse({ worktreeId: 'w', path: 'docs/added.md' }).success).toBe(true)
  })
})
