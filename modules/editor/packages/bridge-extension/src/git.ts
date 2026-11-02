import { normalizeFolderKey } from '@pragma/module-editor/contract'
import type * as vscode from 'vscode'
import { GIT, SCM_CHANGE, type ScmChangeResult } from './constants'

/** The parts of the built-in git extension's API (`vscode.git`, `getAPI(1)`) the diff opener uses. */
interface GitChange {
  readonly uri: vscode.Uri
  readonly renameUri?: vscode.Uri
}
interface GitRepository {
  readonly state: { readonly workingTreeChanges: readonly GitChange[]; readonly indexChanges: readonly GitChange[] }
  status(): Promise<void>
}
interface GitApi {
  readonly state: string
  onDidChangeState(cb: (state: string) => void): vscode.Disposable
  getRepository(uri: vscode.Uri): GitRepository | null
  openRepository?(root: vscode.Uri): Promise<GitRepository | null>
  toGitUri(uri: vscode.Uri, ref: string): vscode.Uri
}
interface GitExtension {
  getAPI(version: typeof GIT.apiVersion): GitApi
}

/** One side of a revision diff: `ref` null = the file on disk. */
export interface RevisionSide {
  path: string
  ref: string | null
}

export interface GitPort {
  /** VS Code's own SCM diff ("Open Changes", `git.openChange`): the unstaged change, else the staged one. */
  openScmChange(absPath: string): Promise<ScmChangeResult>
  /** `vscode.diff` of two revisions (`git:` URIs); false without a git repository. */
  openRevisionDiff(left: RevisionSide, right: RevisionSide, title: string): Promise<boolean>
}

function waitInitialized(api: GitApi): Promise<void> {
  if (api.state === GIT.initialized) return Promise.resolve()
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer)
      sub.dispose()
      resolve()
    }
    const timer = setTimeout(done, GIT.readyTimeoutMs)
    const sub = api.onDidChangeState((s) => {
      if (s === GIT.initialized) done()
    })
  })
}

/** The git API, or null when the extension is missing or disabled (`git.enabled: false`). */
async function gitApi(vs: typeof vscode): Promise<GitApi | null> {
  const ext = vs.extensions.getExtension<GitExtension>(GIT.extensionId)
  if (!ext) return null
  try {
    const exports = ext.isActive ? ext.exports : await ext.activate()
    const api = exports.getAPI(GIT.apiVersion)
    await waitInitialized(api)
    return api
  } catch {
    return null
  }
}

async function repositoryFor(vs: typeof vscode, api: GitApi, uri: vscode.Uri): Promise<GitRepository | null> {
  const known = api.getRepository(uri)
  if (known) return known
  const folder = vs.workspace.workspaceFolders?.[0]?.uri
  return folder ? ((await api.openRepository?.(folder)) ?? null) : null
}

const sameFile = (key: string) => (uri: vscode.Uri | undefined) =>
  uri !== undefined && normalizeFolderKey(uri.fsPath) === key

export function createGitPort(vs: typeof vscode): GitPort {
  const open = async (absPath: string) => {
    const api = await gitApi(vs)
    const uri = vs.Uri.file(absPath)
    const repo = api ? await repositoryFor(vs, api, uri) : null
    return api && repo ? { api, repo, uri } : null
  }
  return {
    async openScmChange(absPath) {
      const git = await open(absPath)
      if (!git) return SCM_CHANGE.noRepository
      await git.repo.status()
      const same = sameFile(normalizeFolderKey(absPath))
      const { workingTreeChanges, indexChanges } = git.repo.state
      const change = [...workingTreeChanges, ...indexChanges].find((c) => same(c.uri) || same(c.renameUri))
      if (!change) return SCM_CHANGE.notChanged
      await vs.commands.executeCommand(GIT.openChange, change.uri)
      return SCM_CHANGE.opened
    },
    async openRevisionDiff(left, right, title) {
      const git = await open(right.path)
      if (!git) return false
      const side = (s: RevisionSide): vscode.Uri =>
        s.ref === null ? vs.Uri.file(s.path) : git.api.toGitUri(vs.Uri.file(s.path), s.ref)
      await vs.commands.executeCommand(GIT.vscodeDiff, side(left), side(right), title, { preview: false })
      return true
    },
  }
}
