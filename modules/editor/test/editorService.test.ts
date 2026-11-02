import { describe, expect, it } from 'vitest'
import { type EditorStatus, editorSettingsDefaults, OpenFileArgsSchema } from '../src/contract'
import { EditorServiceImpl } from '../src/main/editorService'
import type { ServerController } from '../src/main/server/serverController'
import { fakeUpstream } from './support/fakeUpstream'

const READY: EditorStatus = { state: 'ready', version: 'v', port: 1 }
const WT = [
  { id: 'w1', path: '/work/one' },
  { id: 'w2', path: '/work/two' },
]

function setup(status: EditorStatus = READY) {
  const up = fakeUpstream(undefined, WT)
  const calls: string[] = []
  const opened: unknown[] = []
  const themes: unknown[] = []
  const server = { ensureRunning: async () => status, status: () => status } as unknown as ServerController
  const service = new EditorServiceImpl({
    server,
    views: { show: (w) => void calls.push(`show:${w.id}`) },
    bridge: {
      openFile: async (key, m) => void opened.push([key, m]),
      pushTheme: (m) => void themes.push(m),
    },
    up,
    settings: () => editorSettingsDefaults,
    publishReveal: (id) => void calls.push(`reveal:${id}`),
    markActivated: () => void calls.push('activated'),
  })
  return { up, calls, opened, themes, service }
}

describe('EditorServiceImpl', () => {
  it('openFile unknown worktree → worktreeNotFound', async () => {
    const { service } = setup()
    expect(await service.openFile({ worktreeId: 'nope', path: 'a.ts' })).toEqual({
      ok: false,
      errorKey: 'editor:errors.worktreeNotFound',
    })
  })

  it('openFile active worktree shows view, publishes reveal, sends bridge openFile with line/column', async () => {
    const { service, calls, opened, up } = setup()
    expect(await service.openFile({ worktreeId: 'w1', path: 'src/long.ts', line: 42, column: 3 })).toEqual({ ok: true })
    expect(up.selected).toEqual([])
    expect(calls).toEqual(['activated', 'show:w1', 'reveal:w1'])
    expect(opened).toEqual([['/work/one', { path: 'src/long.ts', line: 42, column: 3 }]])
  })

  it('openFile inactive worktree executes projects.selectWorktree first', async () => {
    const { service, up } = setup()
    await service.openFile({ worktreeId: 'w2', path: 'a.ts' })
    expect(up.selected).toEqual(['w2'])
  })

  it('openFile while the server cannot start → openFileFailed', async () => {
    const { service } = setup({ state: 'error', version: 'v', errorKey: 'x', retryable: true })
    expect(await service.openFile({ worktreeId: 'w1', path: 'a.ts' })).toEqual({
      ok: false,
      errorKey: 'editor:errors.openFileFailed',
    })
  })

  it('setTheme pushes an override', async () => {
    const { service, themes } = setup()
    await service.setTheme('light', { bg: '#fff' })
    expect(themes).toEqual([{ themeName: 'Light Modern', mode: 'light', colors: { bg: '#fff' } }])
  })

  it('command editor.openFile validates args (line 0 rejected)', () => {
    expect(OpenFileArgsSchema.safeParse({ worktreeId: 'w1', path: 'a', line: 0 }).success).toBe(false)
  })
})
