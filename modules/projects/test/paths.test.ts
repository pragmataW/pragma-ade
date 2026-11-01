import { describe, expect, it } from 'vitest'
import { branchSlug, defaultWorktreePath, expandHome, projectSlug } from '../src/main/paths'

describe('slugs and worktree paths', () => {
  it.each([
    ['feat/Login Page', 'feat-login-page'],
    ['Ünïcode/çay', 'unicode-cay'],
    ['---', 'worktree'],
    ['a'.repeat(120), 'a'.repeat(80)],
  ])('branchSlug(%s) = %s', (input, out) => expect(branchSlug(input)).toBe(out))

  it.each([
    ['My Repo', 'my-repo'],
    ['???', 'project'],
  ])('projectSlug(%s) = %s', (input, out) => expect(projectSlug(input)).toBe(out))

  it.each([
    ['~/pragma/worktrees', '/Users/u/pragma/worktrees'],
    ['~', '/Users/u'],
    ['~\\win', '/Users/u/win'],
    ['/abs', '/abs'],
  ])('expandHome(%s) = %s', (p, out) => expect(expandHome(p, '/Users/u')).toBe(out))

  it('defaultWorktreePath joins root/project/branch', () => {
    expect(
      defaultWorktreePath({ root: '~/wt', projectName: 'App', branch: 'fix/x', home: '/h', exists: () => false }),
    ).toBe('/h/wt/app/fix-x')
  })

  it('defaultWorktreePath de-duplicates', () => {
    const taken = new Set(['/r/my-repo/feat-x', '/r/my-repo/feat-x-2'])
    expect(
      defaultWorktreePath({
        root: '/r',
        projectName: 'My Repo',
        branch: 'feat/x',
        home: '/h',
        exists: (p) => taken.has(p),
      }),
    ).toBe('/r/my-repo/feat-x-3')
  })
})
