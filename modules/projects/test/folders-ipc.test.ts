import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type FoldersSnapshot, projectsIpc as I, projectsIpcEvents } from '../src/contract'
import { createCleanups } from './support/cleanups'
import { makeRepo } from './support/git-fixture'
import { type ProjectsHost, startProjectsHost } from './support/main-harness'
import { unwrap } from './support/result'

const cleanups = createCleanups()
let h: ProjectsHost
let published: FoldersSnapshot[]
beforeEach(async () => {
  h = await startProjectsHost()
  published = []
  h.t.ipc.subscribe(projectsIpcEvents.foldersChanged, (s) => void published.push(s))
})
afterEach(async () => {
  await h.dispose()
  cleanups.run()
})

async function projectWithMain() {
  const repo = cleanups.track(await makeRepo())
  const project = unwrap(await h.t.ipc.invoke(I.addProject, { path: repo.dir }))
  const [main] = await h.service.listWorktrees(project.id)
  if (!main) throw new Error('main checkout missing')
  return { projectId: project.id, mainId: main.id }
}

describe('folder IPC', () => {
  it('create, move, collapse, rename and delete round-trip and publish foldersChanged', async () => {
    const { projectId, mainId } = await projectWithMain()
    expect(await h.t.ipc.invoke(I.getFolders, undefined)).toEqual({ [projectId]: [] })
    const folder = unwrap(await h.t.ipc.invoke(I.createFolder, { projectId, name: 'Mine', worktreeId: mainId }))
    unwrap(await h.t.ipc.invoke(I.setFolderCollapsed, { projectId, folderId: folder.id, collapsed: true }))
    unwrap(await h.t.ipc.invoke(I.renameFolder, { projectId, folderId: folder.id, name: 'Ours' }))
    const expected = { ...folder, name: 'Ours', collapsed: true, worktreeIds: [mainId] }
    expect(await h.t.ipc.invoke(I.getFolders, undefined)).toEqual({ [projectId]: [expected] })
    unwrap(await h.t.ipc.invoke(I.moveWorktreeToFolder, { worktreeId: mainId, folderId: null }))
    unwrap(await h.t.ipc.invoke(I.deleteFolder, { projectId, folderId: folder.id }))
    expect(published.at(-1)).toEqual({ [projectId]: [] })
    expect(published).toHaveLength(5)
  })

  it('expected failures are error results, not IPC errors', async () => {
    const { projectId } = await projectWithMain()
    expect(await h.t.ipc.invoke(I.createFolder, { projectId, name: ' ' })).toEqual({
      ok: false,
      error: { code: 'invalidFolderName', detail: ' ' },
    })
    expect(await h.t.ipc.invoke(I.deleteFolder, { projectId, folderId: 'nope' })).toEqual({
      ok: false,
      error: { code: 'folderNotFound', detail: 'nope' },
    })
    expect(published).toEqual([])
  })
})
