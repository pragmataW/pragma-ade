import {
  type BridgeClient,
  BridgeUnavailableError,
  createBridgeClient,
  readBridgeInfo,
  type WebSocketCtor,
} from '@pragma/module-bridge/client'
import { BRIDGE_CLIENT_STATE, BRIDGE_UNAVAILABLE } from '@pragma/module-bridge/contract'
import {
  EDITOR_CLIENT_KIND,
  EDITOR_CLIENT_NAME,
  type EditorDrafts,
  type EditorHelloReply,
  type EditorOpenDiffMsg,
  type EditorOpenFileMsg,
  type EditorSetThemeMsg,
  type EditorTestRequest,
  editorBridge,
  normalizeFolderKey,
} from '@pragma/module-editor/contract'
import type { z } from '@pragma/sdk'
import WebSocket from 'ws'
import { CONNECTION, DRAFTS_MESSAGE, MESSAGES, RECONNECT } from './constants'
import type { VscodeApi } from './vscodeApi'

export type EditorEventHandlers = {
  openFile(m: EditorOpenFileMsg): Promise<void>
  openDiff(m: EditorOpenDiffMsg): Promise<void>
  setTheme(m: EditorSetThemeMsg): Promise<void>
  testRequest?(m: EditorTestRequest): Promise<void>
  drafts(m: EditorDrafts): Promise<void>
  /** After every hello (first connect and each reconnect). */
  ready(): Promise<void>
}

type Requests = typeof editorBridge.requests
type RequestName = keyof Requests & string

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** The extension's bridge client: hello per (re)connect, typed requests, silently disabled without a bridge. */
export class BridgeConnection {
  readonly #api: VscodeApi
  readonly #o: { extensionVersion: string; createClient: typeof createBridgeClient; readInfo: typeof readBridgeInfo }
  #client: BridgeClient | undefined
  #handlers: EditorEventHandlers | undefined
  #folder: string | undefined
  #hello: EditorHelloReply | undefined
  #disposers: (() => void)[] = []

  constructor(
    api: VscodeApi,
    o: { extensionVersion: string; createClient?: typeof createBridgeClient; readInfo?: typeof readBridgeInfo },
  ) {
    this.#api = api
    this.#o = {
      extensionVersion: o.extensionVersion,
      createClient: o.createClient ?? createBridgeClient,
      readInfo: o.readInfo ?? readBridgeInfo,
    }
  }

  get folderKey(): string | undefined {
    return this.#folder === undefined ? undefined : normalizeFolderKey(this.#folder)
  }

  get folderPath(): string | undefined {
    return this.#folder
  }

  get hello(): EditorHelloReply | undefined {
    return this.#hello
  }

  async start(handlers: EditorEventHandlers): Promise<'disabled' | 'connected'> {
    this.#handlers = handlers
    this.#folder = this.#api.workspaceFolderPath()
    if (!this.#folder) return this.#disabled(MESSAGES.disabledNoFolder)
    let info: Awaited<ReturnType<typeof readBridgeInfo>>
    try {
      info = await this.#o.readInfo({ env: this.#api.env })
    } catch (error) {
      if (error instanceof BridgeUnavailableError) return this.#disabled(MESSAGES.disabledNoBridge)
      throw error
    }
    const client = this.#o.createClient({
      connection: { url: info.url, token: info.token },
      client: { kind: EDITOR_CLIENT_KIND, name: EDITOR_CLIENT_NAME, version: this.#o.extensionVersion },
      subscribe: [editorBridge.name],
      WebSocket: WebSocket as unknown as WebSocketCtor,
      reconnect: RECONNECT,
    })
    this.#client = client
    this.#listen(client, handlers)
    await client.ready()
    await this.#sayHello()
    this.#api.log(MESSAGES.connected)
    return CONNECTION.connected
  }

  async request<K extends RequestName>(
    name: K,
    payload: z.input<Requests[K]['input']>,
  ): Promise<z.infer<Requests[K]['output']>> {
    const client = this.#client
    if (!client || client.state !== BRIDGE_CLIENT_STATE.open)
      throw new BridgeUnavailableError(BRIDGE_UNAVAILABLE.unreachable, MESSAGES.offline)
    return client.request(editorBridge, name, payload)
  }

  dispose(): void {
    for (const d of this.#disposers.splice(0)) d()
    this.#client?.close()
    this.#client = undefined
  }

  #disabled(msg: string): typeof CONNECTION.disabled {
    this.#api.log(msg)
    return CONNECTION.disabled
  }

  #listen(client: BridgeClient, h: EditorEventHandlers): void {
    const run = (p: Promise<void>): void => void p.catch((e: unknown) => this.#api.log(errorText(e)))
    this.#disposers.push(
      client.on(editorBridge, 'openFile', (m) => run(h.openFile(m))),
      client.on(editorBridge, 'openDiff', (m) => run(h.openDiff(m))),
      client.on(editorBridge, 'setTheme', (m) => run(h.setTheme(m))),
      client.on(editorBridge, DRAFTS_MESSAGE, (m) => run(h.drafts(m))),
      client.on(editorBridge, 'testRequest', (m) => {
        if (h.testRequest) run(h.testRequest(m))
      }),
    )
    let opened = false
    this.#disposers.push(
      client.onStateChange((s) => {
        if (s !== BRIDGE_CLIENT_STATE.open) return
        if (opened) void this.#sayHello().catch((e: unknown) => this.#api.log(`${MESSAGES.helloFailed}${errorText(e)}`))
        opened = true
      }),
    )
  }

  async #sayHello(): Promise<void> {
    const folder = this.#folder as string
    const reply = await this.request('hello', {
      folderKey: normalizeFolderKey(folder),
      folderPath: folder,
      extensionVersion: this.#o.extensionVersion,
    })
    this.#hello = reply
    await this.#handlers?.setTheme(reply.theme)
    await this.#handlers?.ready()
  }
}
