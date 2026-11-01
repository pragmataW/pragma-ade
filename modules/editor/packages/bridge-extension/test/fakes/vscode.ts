import type { CommentControllerSpec, ThreadLike, VscodeApi } from '../../src/vscodeApi'

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
  commands: Map<string, (reply: { thread: ThreadLike; text: string }) => unknown>
  documents: Map<string, { lines: string[]; languageId: string }>
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
  const commands: FakeApi['commands'] = new Map()
  const documents: FakeApi['documents'] = new Map()
  const disposable = { dispose: () => undefined }
  return {
    env: o.env ?? {},
    workspaceFolderPath: () => o.folder,
    log: (m) => logs.push(m),
    showInfo: (m) => infos.push(m),
    showWarning: (m) => warnings.push(m),
    openAndReveal: async (path, line, column) => void opened.push({ path, line, column }),
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
      return disposable
    },
    registerReplyCommand: (id, handler) => {
      commands.set(id, handler)
      return disposable
    },
    readDocument: async (uri) => documents.get(uri.fsPath) ?? { lines: [], languageId: 'plaintext' },
    controllers,
    commands,
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
