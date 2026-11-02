import { describe, expect, it } from 'vitest'
import type * as vscode from 'vscode'
import { createGitPort } from '../src/git'

type FakeUri = { scheme: string; fsPath: string; ref?: string }
const file = (fsPath: string): FakeUri => ({ scheme: 'file', fsPath })

interface FakeGit {
  state?: string
  repo?: boolean
  working?: FakeUri[]
  index?: FakeUri[]
  /** The repository is only found by `openRepository` (not discovered yet). */
  undiscovered?: boolean
  noExtension?: boolean
}

/** Just enough of `vscode` (extensions, workspace, Uri, commands) for the git port. */
function fakeVscode(g: FakeGit = {}) {
  const executed: { id: string; args: unknown[] }[] = []
  const calls: string[] = []
  const repo = {
    state: {
      workingTreeChanges: (g.working ?? []).map((uri) => ({ uri })),
      indexChanges: (g.index ?? []).map((uri) => ({ uri })),
    },
    status: async () => void calls.push('status'),
  }
  const listeners: ((s: string) => void)[] = []
  const api = {
    state: g.state ?? 'initialized',
    onDidChangeState: (cb: (s: string) => void) => {
      listeners.push(cb)
      return { dispose: () => undefined }
    },
    getRepository: () => (g.repo === false || g.undiscovered ? null : repo),
    openRepository: async (root: FakeUri) => {
      calls.push(`open:${root.fsPath}`)
      return g.repo === false ? null : repo
    },
    toGitUri: (uri: FakeUri, ref: string): FakeUri => ({ scheme: 'git', fsPath: uri.fsPath, ref }),
  }
  const ext = { isActive: false, exports: undefined, activate: async () => ({ getAPI: () => api }) }
  const vs = {
    extensions: { getExtension: () => (g.noExtension ? undefined : ext) },
    workspace: { workspaceFolders: [{ uri: file('/work/repo') }] },
    Uri: { file },
    commands: { executeCommand: async (id: string, ...args: unknown[]) => void executed.push({ id, args }) },
  }
  const fire = (s: string) => {
    for (const l of listeners) l(s)
  }
  return { vs: vs as unknown as typeof vscode, executed, calls, fire, api }
}

describe('git port', () => {
  it('openScmChange runs git.openChange with the change git lists (case-insensitive on darwin)', async () => {
    const changed = file('/work/repo/src/App.ts')
    const f = fakeVscode({ working: [file('/work/repo/other.ts')], index: [changed] })
    const r = await createGitPort(f.vs).openScmChange(
      process.platform === 'linux' ? changed.fsPath : '/work/repo/src/app.ts',
    )
    expect(r).toBe('opened')
    expect(f.calls).toEqual(['status'])
    expect(f.executed).toEqual([{ id: 'git.openChange', args: [changed] }])
  })

  it('openScmChange: a file git does not list → notChanged, nothing executed', async () => {
    const f = fakeVscode({ working: [file('/work/repo/other.ts')] })
    expect(await createGitPort(f.vs).openScmChange('/work/repo/src/app.ts')).toBe('notChanged')
    expect(f.executed).toEqual([])
  })

  it.each([
    ['no git extension', { noExtension: true }],
    ['no repository', { repo: false }],
  ])('openScmChange: %s → noRepository', async (_n, g) => {
    const f = fakeVscode(g)
    expect(await createGitPort(f.vs).openScmChange('/work/repo/a.ts')).toBe('noRepository')
  })

  it('openRevisionDiff opens the workspace repository when it is not discovered yet and diffs git: URIs', async () => {
    const f = fakeVscode({ undiscovered: true })
    const ok = await createGitPort(f.vs).openRevisionDiff(
      { path: '/work/repo/a.ts', ref: 'abc' },
      { path: '/work/repo/a.ts', ref: null },
      'a.ts (abc ↔ Working Tree)',
    )
    expect(ok).toBe(true)
    expect(f.calls).toEqual(['open:/work/repo'])
    expect(f.executed).toEqual([
      {
        id: 'vscode.diff',
        args: [
          { scheme: 'git', fsPath: '/work/repo/a.ts', ref: 'abc' },
          file('/work/repo/a.ts'),
          'a.ts (abc ↔ Working Tree)',
          { preview: false },
        ],
      },
    ])
  })

  it('waits for the git extension to finish its first scan', async () => {
    const f = fakeVscode({ state: 'uninitialized', working: [file('/work/repo/a.ts')] })
    const pending = createGitPort(f.vs).openScmChange('/work/repo/a.ts')
    await new Promise((r) => setTimeout(r, 10))
    expect(f.executed).toEqual([])
    f.fire('initialized')
    expect(await pending).toBe('opened')
  })
})
