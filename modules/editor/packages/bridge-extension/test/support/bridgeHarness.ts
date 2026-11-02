import { BRIDGE_ENV } from '@pragma/module-bridge/contract'
import { startTestBridgeServer, type TestBridgeServer } from '@pragma/module-bridge/testing'
import { type EditorHello, type EditorTheme, editorBridge } from '@pragma/module-editor/contract'
import { vi } from 'vitest'
import { BridgeConnection, type EditorEventHandlers } from '../../src/bridgeConnection'
import { type FakeApi, fakeApi } from '../fakes/vscode'

export const THEME: EditorTheme = { themeName: 'Dark Modern', mode: 'dark' }

/** A real bridge server with recording `editor` handlers. */
export async function startEditorBridge(o: { port?: number; token?: string } = {}) {
  const server: TestBridgeServer = await startTestBridgeServer(o)
  const hellos: { hello: EditorHello; clientId: string }[] = []
  server.registerHandler(editorBridge, {
    hello: (hello, ctx) => {
      hellos.push({ hello, clientId: ctx.clientId })
      return { known: true, worktreeId: 'wt1', theme: THEME }
    },
    comment: () => ({ status: 'drafted' as const, commentId: 'c1' }),
    testResponse: () => null,
    languageStatus: () => null,
  })
  return { server, hellos }
}

/** Handlers recording every event the connection dispatches. */
export function recordingHandlers() {
  const events: { name: string; payload: unknown }[] = []
  const handlers: EditorEventHandlers = {
    openFile: async (m) => void events.push({ name: 'openFile', payload: m }),
    openDiff: async (m) => void events.push({ name: 'openDiff', payload: m }),
    setTheme: async (m) => void events.push({ name: 'setTheme', payload: m }),
    testRequest: async (m) => void events.push({ name: 'testRequest', payload: m }),
  }
  return { events, handlers }
}

export function connectionFor(server: TestBridgeServer, folder = '/Work/Repo') {
  const api: FakeApi = fakeApi({ folder, env: { [BRIDGE_ENV.url]: server.url, [BRIDGE_ENV.token]: server.token } })
  const conn = new BridgeConnection(api, { extensionVersion: '0.1.0' })
  return { api, conn }
}

/** Waits until `cond` holds (vitest polling). */
export const until = (cond: () => boolean, timeout = 5000): Promise<void> =>
  vi.waitFor(
    () => {
      if (!cond()) throw new Error('condition not met')
    },
    { timeout, interval: 20 },
  )
