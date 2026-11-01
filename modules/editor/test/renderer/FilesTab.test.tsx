import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EditorIpc, EditorIpcEvents, type EditorStatus, EDITOR_TEST_IDS as T } from '../../src/contract'
import { FilesTab } from '../../src/renderer/FilesTab'
import editorRenderer from '../../src/renderer/index'
import { renderEditor, text } from '../support/renderer'

const status = (s: EditorStatus) => ({ [EditorIpc.getStatus.channel]: s })

describe('FilesTab', () => {
  it('downloading shows progressbar with 50% and Cancel calls editor.cancelDownload', async () => {
    const r = await renderEditor(<FilesTab />, {
      replies: status({ state: 'downloading', version: 'v', received: 50, total: 100 }),
    })
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')
    fireEvent.click(screen.getByTestId(T.cancel))
    expect(r.calls.map((c) => c.channel)).toContain(EditorIpc.cancelDownload.channel)
    expect(r.calls.map((c) => c.channel)).toContain(EditorIpc.ensureReady.channel)
  })

  it.each([
    [
      'checksum error shows Retry and Re-download',
      { state: 'error', version: 'v', errorKey: 'editor:errors.checksumMismatch', retryable: true },
      [T.retry, T.redownload],
      'errors.checksumMismatch',
    ],
    [
      'not installed shows Download',
      { state: 'not-installed', version: 'v', sizeBytes: 96_507_870 },
      [T.download],
      null,
    ],
    ['starting shows text', { state: 'starting', version: 'v' }, [], 'status.starting'],
  ] as const)('%s', async (_label, s, ids, key) => {
    await renderEditor(<FilesTab />, { replies: status(s as EditorStatus) })
    for (const id of ids) expect(screen.getByTestId(id)).toBeTruthy()
    if (key) expect(screen.getByText(text(key))).toBeTruthy()
  })

  it('ready renders no status text', async () => {
    await renderEditor(<FilesTab />, { replies: status({ state: 'ready', version: 'v', port: 1 }) })
    expect(screen.getByTestId(T.filesTab)).toBeTruthy()
    expect(screen.queryByTestId(T.status)).toBeNull()
  })

  it('no worktree shows noWorktree text', async () => {
    await renderEditor(<FilesTab />, {
      activeWorktree: null,
      replies: status({ state: 'ready', version: 'v', port: 1 }),
    })
    expect(screen.getByText(text('status.noWorktree'))).toBeTruthy()
  })

  it('statusChanged updates the panel', async () => {
    const r = await renderEditor(<FilesTab />, { replies: status({ state: 'starting', version: 'v' }) })
    await r.emit(EditorIpcEvents.statusChanged, { state: 'ready', version: 'v', port: 1 })
    expect(screen.queryByTestId(T.status)).toBeNull()
  })

  it('revealRequested activates the files tab', () => {
    const listeners = new Map<string, () => void>()
    const ctx = {
      panels: { registerRightTab: vi.fn(), activateRightTab: vi.fn() },
      settingsPages: { register: vi.fn() },
      slots: { register: vi.fn() },
      ipc: { subscribe: (c: { channel: string }, cb: () => void) => listeners.set(c.channel, cb) },
    }
    editorRenderer.activate(ctx as never)
    listeners.get(EditorIpcEvents.revealRequested.channel)?.()
    expect(ctx.panels.activateRightTab).toHaveBeenCalledWith('files')
    expect(ctx.panels.registerRightTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'files', order: 30 }))
  })
})
