import { describe, expect, it } from 'vitest'
import { diffTitle, handleOpenDiff } from '../src/handlers/openDiff'
import { fakeApi } from './fakes/vscode'

const FOLDER = '/work/repo'
const SHA = '0123456789abcdef0123456789abcdef01234567'
const APP = '/work/repo/src/app.ts'

function setup(git: { scm?: 'opened' | 'notChanged' | 'noRepository'; hasRepo?: boolean } = {}) {
  const api = fakeApi({ folder: FOLDER })
  Object.assign(api.git, git)
  return api
}

describe('handleOpenDiff', () => {
  it('uncommitted: opens the SCM change of the absolute path and reveals the line', async () => {
    const api = setup()
    await handleOpenDiff(api, FOLDER, { path: 'src/app.ts', line: 10 })
    expect(api.scmOpened).toEqual([APP])
    expect(api.revisionDiffs).toEqual([])
    expect(api.revealed).toEqual([10])
    expect(api.opened).toEqual([])
  })

  it('uncommitted, git does not list the file: HEAD ↔ working tree', async () => {
    const api = setup({ scm: 'notChanged' })
    await handleOpenDiff(api, FOLDER, { path: 'src/app.ts' })
    expect(api.revisionDiffs).toEqual([
      { left: { path: APP, ref: 'HEAD' }, right: { path: APP, ref: null }, title: 'app.ts (HEAD ↔ Working Tree)' },
    ])
    expect(api.revealed).toEqual([])
  })

  it('refs: old (renamed) path at the merge-base ↔ HEAD, short sha in the title', async () => {
    const api = setup()
    await handleOpenDiff(api, FOLDER, { path: 'src/new.ts', oldPath: 'src/old.ts', refs: { old: SHA, new: 'HEAD' } })
    expect(api.scmOpened).toEqual([])
    expect(api.revisionDiffs).toEqual([
      {
        left: { path: '/work/repo/src/old.ts', ref: SHA },
        right: { path: '/work/repo/src/new.ts', ref: 'HEAD' },
        title: 'new.ts (0123456 ↔ HEAD)',
      },
    ])
  })

  it.each([
    ['no git repository (SCM)', { scm: 'noRepository' as const }, {}],
    ['no git repository (refs)', { hasRepo: false }, { refs: { old: SHA, new: 'HEAD' } }],
  ])('%s: the plain file opens at the line', async (_n, git, extra) => {
    const api = setup(git)
    await handleOpenDiff(api, FOLDER, { path: 'src/app.ts', line: 4, ...extra })
    expect(api.opened).toEqual([{ path: APP, line: 4, column: undefined }])
  })

  it.each([{ path: '../outside.ts' }, { path: 'src/app.ts', oldPath: '/etc/passwd' }])(
    'a path outside the folder warns and opens nothing: %o',
    async (m) => {
      const api = setup()
      await handleOpenDiff(api, FOLDER, m)
      expect(api.warnings).toHaveLength(1)
      expect([...api.scmOpened, ...api.revisionDiffs, ...api.opened]).toEqual([])
    },
  )

  it('diffTitle keeps short refs as they are', () => {
    expect(diffTitle('a/b.ts', 'main', 'HEAD')).toBe('b.ts (main ↔ HEAD)')
  })
})
