import { SCM_CHANGE, type ScmChangeResult } from '../../src/constants'
import type {
  CommentControllerSpec,
  DiagnosticInfo,
  RevisionSide,
  TabInfo,
  ThreadLike,
  ThreadSpec,
  VscodeApi,
} from '../../src/vscodeApi'

/** A recording fake of the `VscodeApi` port. */
export interface FakeApi extends VscodeApi {
  logs: string[]
  infos: string[]
  warnings: string[]
  opened: { path: string; line?: number; column?: number }[]
  config: Map<string, unknown>
  state: Map<string, unknown>
  configWrites: string[]
  controllers: CommentControllerSpec[]
  /** Threads created through a controller: the latest spec, how often it was updated in place, disposed flag. */
  threads: (ThreadSpec & { disposed: boolean; updates: number })[]
  commands: Map<string, (reply: { thread: ThreadLike; text: string }) => unknown>
  /** Thread title commands (they get the thread's Pragma id). */
  threadCommands: Map<string, (threadId: string | undefined) => unknown>
  documents: Map<string, { lines: string[]; languageId: string }>
  diags: Map<string, DiagnosticInfo[]>
  tabList: TabInfo[]
  executed: { id: string; args: unknown[] }[]
  current: { doc?: { languageId: string; path: string }; editor: { path: string; line: number; column: number } | null }
  /** What `openScmChange` answers; `hasRepo` false makes `openRevisionDiff` answer false. */
  git: { scm: ScmChangeResult; hasRepo: boolean }
  scmOpened: string[]
  revisionDiffs: { left: RevisionSide; right: RevisionSide; title: string }[]
  revealed: number[]
  /** Fires the active-editor and diagnostics listeners. */
  fireChange(): void
}

/** A recording comment thread. */
export function fakeThread(fsPath: string, startLine: number, endLine: number, scheme = 'file') {
  const added: { body: string; label: string }[] = []
  let disposed = false
  const thread: ThreadLike = {
    uri: { scheme, fsPath },
    range: { startLine, endLine },
    addComment: (body, label) => void added.push({ body, label }),
    dispose: () => {
      disposed = true
    },
  }
  return { thread, added, isDisposed: () => disposed }
}

const cfgKey = (section: string, key: string): string => `${section}.${key}`

export function fakeApi(o: { folder?: string; env?: Record<string, string | undefined> } = {}): FakeApi {
  const logs: string[] = []
  const infos: string[] = []
  const warnings: string[] = []
  const opened: FakeApi['opened'] = []
  const config = new Map<string, unknown>()
  const state = new Map<string, unknown>()
  const configWrites: string[] = []
  const controllers: CommentControllerSpec[] = []
  const threads: FakeApi['threads'] = []
  const commands: FakeApi['commands'] = new Map()
  const threadCommands: FakeApi['threadCommands'] = new Map()
  const documents: FakeApi['documents'] = new Map()
  const disposable = { dispose: () => undefined }
  const diags: FakeApi['diags'] = new Map()
  const tabList: TabInfo[] = []
  const executed: FakeApi['executed'] = []
  const current: FakeApi['current'] = { editor: null }
  const git: FakeApi['git'] = { scm: SCM_CHANGE.opened, hasRepo: true }
  const scmOpened: string[] = []
  const revisionDiffs: FakeApi['revisionDiffs'] = []
  const revealed: number[] = []
  const listeners = new Set<() => void>()
  const listen = (cb: () => void) => {
    listeners.add(cb)
    return { dispose: () => void listeners.delete(cb) }
  }
  return {
    env: o.env ?? {},
    workspaceFolderPath: () => o.folder,
    log: (m) => logs.push(m),
    showInfo: (m) => infos.push(m),
    showWarning: (m) => warnings.push(m),
    openAndReveal: async (path, line, column) => void opened.push({ path, line, column }),
    revealInActiveEditor: (line) => void revealed.push(line),
    openScmChange: async (path) => {
      if (git.scm === SCM_CHANGE.opened) scmOpened.push(path)
      return git.scm
    },
    openRevisionDiff: async (left, right, title) => {
      if (git.hasRepo) revisionDiffs.push({ left, right, title })
      return git.hasRepo
    },
    getGlobalConfig: <T>(section: string, key: string) => config.get(cfgKey(section, key)) as T | undefined,
    updateGlobalConfig: async (section, key, value) => {
      configWrites.push(cfgKey(section, key))
      config.set(cfgKey(section, key), value)
    },
    globalState: {
      get: <T>(k: string) => state.get(k) as T | undefined,
      update: async (k, v) => void state.set(k, v),
    },
    createCommentController: (spec) => {
      controllers.push(spec)
      return {
        dispose: () => undefined,
        createThread: (t) => {
          const rec = { ...t, disposed: false, updates: 0 }
          threads.push(rec)
          return {
            update: (next) => void Object.assign(rec, next, { updates: rec.updates + 1 }),
            dispose: () => {
              rec.disposed = true
            },
          }
        },
      }
    },
    registerReplyCommand: (id, handler) => {
      commands.set(id, handler)
      return disposable
    },
    registerThreadCommand: (id, handler) => {
      threadCommands.set(id, handler)
      return disposable
    },
    readDocument: async (uri) => documents.get(uri.fsPath) ?? { lines: [], languageId: 'plaintext' },
    diagnostics: (path) => diags.get(path) ?? [],
    executeCommand: async (id, args) => void executed.push({ id, args }),
    tabs: () => tabList,
    extensionActive: (id) => id === 'pragma.pragma-bridge',
    activeEditor: () => current.editor,
    activeDocument: () => current.doc,
    onDidChangeActiveEditor: listen,
    onDidChangeDiagnostics: listen,
    fireChange: () => {
      for (const cb of listeners) cb()
    },
    git,
    scmOpened,
    revisionDiffs,
    revealed,
    diags,
    tabList,
    executed,
    current,
    controllers,
    threads,
    commands,
    threadCommands,
    documents,
    logs,
    infos,
    warnings,
    opened,
    config,
    state,
    configWrites,
  }
}
