import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FOLDERS_STATE_KEY_PREFIX } from '../src/constants'
import type { PROJECTS_ERROR, ProjectsError } from '../src/contract'
import { createFolderStore, type FolderStore } from '../src/main/folders'
import { aProject, aWorktree, makeTestDb } from './support/builders'

let db: ReturnType<typeof makeTestDb>
let store: FolderStore
let changes = 0
let ids = 0
const P = 'p'
const OTHER = 'q'
const [A, B, C] = ['wa', 'wb', 'wc']

beforeEach(() => {
  db = makeTestDb()
  changes = 0
  ids = 0
  db.repo.insertProject(aProject({ id: P }))
  db.repo.insertProject(aProject({ id: OTHER }))
  for (const id of [A, B, C]) db.repo.insertWorktree(aWorktree(P, { id }))
  db.repo.insertWorktree(aWorktree(OTHER, { id: 'wq' }))
  store = createFolderStore({ repo: db.repo, newId: () => `f${++ids}`, onChanged: () => void changes++ })
})
afterEach(() => db.cleanup())

const folders = () => store.list(P)
const expectCode = (fn: () => unknown, code: keyof typeof PROJECTS_ERROR) =>
  expect(fn).toThrowError(expect.objectContaining({ code }) as ProjectsError)

describe('folder store', () => {
  it('creates folders at the end with a trimmed name, expanded and empty, and reports the change', () => {
    expect(store.create(P, '  Reviews ')).toEqual({ id: 'f1', name: 'Reviews', collapsed: false, worktreeIds: [] })
    store.create(P, 'Spikes')
    expect(folders().map((f) => f.name)).toEqual(['Reviews', 'Spikes'])
    expect(changes).toBe(2)
    expect(store.snapshot()).toEqual({ [P]: folders(), [OTHER]: [] })
  })

  it('create with a worktree moves it in (out of any other folder)', () => {
    const first = store.create(P, 'One', A)
    const second = store.create(P, 'Two', A)
    expect(folders()).toEqual([
      { ...first, worktreeIds: [] },
      { ...second, worktreeIds: [A] },
    ])
  })

  it.each([
    ['blank name', () => store.create(P, '   '), 'invalidFolderName'],
    ['too long name', () => store.create(P, 'x'.repeat(65)), 'invalidFolderName'],
    ['unknown project', () => store.create('nope', 'X'), 'projectNotFound'],
    ['worktree of another project', () => store.create(P, 'X', 'wq'), 'worktreeNotFound'],
    ['unknown folder (rename)', () => store.rename(P, 'nope', 'X'), 'folderNotFound'],
    ['unknown folder (delete)', () => store.remove(P, 'nope'), 'folderNotFound'],
    ['unknown folder (collapse)', () => store.setCollapsed(P, 'nope', true), 'folderNotFound'],
    ['unknown folder (move)', () => store.move(A, 'nope'), 'folderNotFound'],
    ['unknown worktree (move)', () => store.move('nope', null), 'worktreeNotFound'],
  ] as const)('rejects %s', (_name, fn, code) => {
    expectCode(fn, code)
    expect(changes).toBe(0)
  })

  it('renames and collapses a folder', () => {
    const f = store.create(P, 'Old')
    store.rename(P, f.id, ' New ')
    store.setCollapsed(P, f.id, true)
    expect(folders()).toEqual([{ ...f, name: 'New', collapsed: true }])
    expectCode(() => store.rename(P, f.id, ''), 'invalidFolderName')
  })

  it('moves worktrees between folders and back to the root; a worktree is in one folder only', () => {
    const one = store.create(P, 'One')
    const two = store.create(P, 'Two')
    store.move(A, one.id)
    store.move(B, one.id)
    store.move(A, two.id)
    expect(folders().map((f) => f.worktreeIds)).toEqual([[B], [A]])
    store.move(A, null)
    expect(folders().map((f) => f.worktreeIds)).toEqual([[B], []])
  })

  it('deleting a folder only drops the folder: its worktrees are back at the root', () => {
    const one = store.create(P, 'One', A)
    const two = store.create(P, 'Two', B)
    store.remove(P, one.id)
    expect(folders()).toEqual([two])
    expect(db.repo.listWorktrees(P).map((w) => w.id)).toEqual([A, B, C])
  })

  it('silently drops worktrees that are gone (archived or never existed)', () => {
    const f = store.create(P, 'One', A)
    store.move(B, f.id)
    db.repo.archiveWorktree(A, 1)
    expect(folders()).toEqual([{ ...f, worktreeIds: [B] }])
    store.move(C, f.id)
    const stored = JSON.parse(db.repo.getState(`${FOLDERS_STATE_KEY_PREFIX}${P}`) ?? '') as unknown
    expect(stored).toEqual({ folders: [{ ...f, worktreeIds: [B, C] }] })
  })

  it.each([
    ['not JSON', '{'],
    ['wrong shape', '[1, 2]'],
    ['folders not a list', '{"folders": 3}'],
  ])('reads %s as no folders', (_name, raw) => {
    db.repo.setState(`${FOLDERS_STATE_KEY_PREFIX}${P}`, raw)
    expect(folders()).toEqual([])
  })

  it('keeps the valid folders of a partly broken value and defaults missing fields', () => {
    const raw = {
      folders: [
        { id: 'x', name: 'Kept' },
        { id: 'y', name: '' },
        { id: 'z', name: 'Dupes', collapsed: true, worktreeIds: [A, A, 'gone'] },
        { name: 'no id' },
      ],
    }
    db.repo.setState(`${FOLDERS_STATE_KEY_PREFIX}${P}`, JSON.stringify(raw))
    expect(folders()).toEqual([
      { id: 'x', name: 'Kept', collapsed: false, worktreeIds: [] },
      { id: 'z', name: 'Dupes', collapsed: true, worktreeIds: [A] },
    ])
  })
})
