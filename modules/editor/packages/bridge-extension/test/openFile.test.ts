import { describe, expect, it } from 'vitest'
import { handleOpenFile } from '../src/handlers/openFile'
import { fakeApi } from './fakes/vscode'

const FOLDER = '/work/repo'

describe('handleOpenFile', () => {
  it('relative path joins folder and selects line 42 col 3', async () => {
    const api = fakeApi({ folder: FOLDER })
    await handleOpenFile(api, FOLDER, { path: 'src/long.ts', line: 42, column: 3 })
    expect(api.opened).toEqual([{ path: '/work/repo/src/long.ts', line: 42, column: 3 }])
  })

  it('openFile without line opens at top', async () => {
    const api = fakeApi({ folder: FOLDER })
    await handleOpenFile(api, FOLDER, { path: 'a.ts' })
    expect(api.opened).toEqual([{ path: '/work/repo/a.ts', line: undefined, column: undefined }])
  })

  it.each(['/etc/passwd', '../outside.ts', '/work/repo-other/a.ts'])(
    'path outside folder warns and does not open: %s',
    async (path) => {
      const api = fakeApi({ folder: FOLDER })
      await handleOpenFile(api, FOLDER, { path })
      expect(api.opened).toEqual([])
      expect(api.warnings).toHaveLength(1)
    },
  )

  it('absolute path inside the folder opens', async () => {
    const api = fakeApi({ folder: FOLDER })
    await handleOpenFile(api, FOLDER, { path: '/work/repo/x/y.ts', line: 2 })
    expect(api.opened[0]?.path).toBe('/work/repo/x/y.ts')
  })
})
