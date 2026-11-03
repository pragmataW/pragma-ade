import { type BridgeClient, createBridgeClient } from '@pragma/module-bridge/client'
import { startTestBridgeServer, type TestBridgeServer } from '@pragma/module-bridge/testing'
import type { Comment, CommentInput, SendResult } from '@pragma/module-comments/contract'
import { EDITOR_CLIENT_KIND, editorBridge, normalizeFolderKey } from '../../src/contract'
import type { EditorUpstream, WorktreeRef } from '../../src/main/upstream'

export interface FakeUpstream extends EditorUpstream {
  drafts: CommentInput[]
  sends: string[][]
  selected: string[]
  sendResult: SendResult
  worktrees: WorktreeRef[]
  active: string | null
  /** What `listThreads` answers (filtered by worktree). */
  stored: Comment[]
  emitSelected(id: string | null): void
  emitRemoved(id: string): void
  emitCommentsChanged(worktreeId: string): void
}

/** Projects/comments fakes around a real (or no) bridge server. */
export function fakeUpstream(server?: TestBridgeServer, worktrees: WorktreeRef[] = []): FakeUpstream {
  const selectedCbs = new Set<(id: string | null) => void>()
  const removedCbs = new Set<(id: string) => void>()
  const commentsCbs = new Set<(id: string) => void>()
  const up: FakeUpstream = {
    drafts: [],
    sends: [],
    selected: [],
    sendResult: { status: 'sent', sessionId: 's1', commentIds: [], sentAt: 1 },
    worktrees,
    active: worktrees[0]?.id ?? null,
    stored: [],
    getActiveWorktreeId: () => up.active,
    getWorktree: async (id) => up.worktrees.find((w) => w.id === id) ?? null,
    findWorktreeByFolderKey: async (key) => up.worktrees.find((w) => normalizeFolderKey(w.path) === key) ?? null,
    onWorktreeSelected: (cb) => {
      selectedCbs.add(cb)
      return () => selectedCbs.delete(cb)
    },
    onWorktreeRemoved: (cb) => {
      removedCbs.add(cb)
      return () => removedCbs.delete(cb)
    },
    selectWorktree: async (id) => {
      up.selected.push(id)
      up.active = id
      for (const cb of selectedCbs) cb(id)
    },
    bridge: server as unknown as EditorUpstream['bridge'],
    addDraft: async (i) => {
      up.drafts.push(i)
      return { id: `c${up.drafts.length}` } as Comment
    },
    send: async (ids) => {
      up.sends.push(ids)
      return up.sendResult
    },
    listThreads: async (worktreeId) => up.stored.filter((c) => c.worktreeId === worktreeId),
    onCommentsChanged: (cb) => {
      commentsCbs.add(cb)
      return () => commentsCbs.delete(cb)
    },
    emitSelected: (id) => {
      for (const cb of selectedCbs) cb(id)
    },
    emitRemoved: (id) => {
      for (const cb of removedCbs) cb(id)
    },
    emitCommentsChanged: (id) => {
      for (const cb of commentsCbs) cb(id)
    },
  }
  return up
}

/** A `createBridgeClient` acting as the extension for `folder`. */
export async function extensionClient(server: TestBridgeServer, folder: string) {
  const client: BridgeClient = createBridgeClient({
    connection: server.connection,
    client: { kind: EDITOR_CLIENT_KIND },
    subscribe: [editorBridge.name],
  })
  await client.ready()
  const received: { name: string; payload: unknown }[] = []
  for (const name of Object.keys(editorBridge.events) as (keyof typeof editorBridge.events)[])
    client.on(editorBridge, name, (payload) => received.push({ name, payload }))
  const folderKey = normalizeFolderKey(folder)
  const hello = () =>
    client.request(editorBridge, 'hello', { folderKey, folderPath: folder, extensionVersion: '0.1.0' })
  return { client, received, folderKey, hello }
}

export { startTestBridgeServer }
