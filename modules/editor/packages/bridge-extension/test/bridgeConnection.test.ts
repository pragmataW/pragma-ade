import { BridgeUnavailableError } from '@pragma/module-bridge/client'
import { editorBridge, normalizeFolderKey } from '@pragma/module-editor/contract'
import { afterEach, describe, expect, it } from 'vitest'
import { BridgeConnection } from '../src/bridgeConnection'
import { fakeApi } from './fakes/vscode'
import { connectionFor, recordingHandlers, startEditorBridge, THEME, until } from './support/bridgeHarness'

const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c()
})

async function connected(folder?: string) {
  const bridge = await startEditorBridge()
  cleanups.push(() => bridge.server.close())
  const { api, conn } = connectionFor(bridge.server, folder)
  cleanups.push(() => conn.dispose())
  const rec = recordingHandlers()
  expect(await conn.start(rec.handlers)).toBe('connected')
  return { ...bridge, api, conn, ...rec }
}

describe('BridgeConnection', () => {
  it('disabled without bridge env and discovery, no warning shown', async () => {
    const api = fakeApi({ folder: '/w' })
    const conn = new BridgeConnection(api, {
      extensionVersion: '0.1.0',
      readInfo: async () => {
        throw new BridgeUnavailableError('no_config')
      },
    })
    expect(await conn.start(recordingHandlers().handlers)).toBe('disabled')
    expect(api.warnings).toEqual([])
    expect(api.logs).toHaveLength(1)
  })

  it('disabled without a workspace folder', async () => {
    const conn = new BridgeConnection(fakeApi(), { extensionVersion: '0.1.0' })
    expect(await conn.start(recordingHandlers().handlers)).toBe('disabled')
  })

  it('sends hello with normalized folderKey and applies theme from reply', async () => {
    const c = await connected('/Work/Repo/')
    expect(c.hellos[0]?.hello).toEqual({
      folderKey: normalizeFolderKey('/Work/Repo/'),
      folderPath: '/Work/Repo/',
      extensionVersion: '0.1.0',
    })
    expect(c.events).toEqual([{ name: 'setTheme', payload: THEME }])
    expect(c.conn.hello?.worktreeId).toBe('wt1')
  })

  it('dispatches openFile sent to this client', async () => {
    const c = await connected()
    const clientId = c.hellos[0]?.clientId as string
    c.server.send(clientId, { type: 'editor.openFile', payload: { path: 'src/a.ts', line: 3 } })
    await until(() => c.events.some((e) => e.name === 'openFile'))
    expect(c.events.at(-1)).toEqual({ name: 'openFile', payload: { path: 'src/a.ts', line: 3 } })
  })

  it('setTheme broadcast reaches the client', async () => {
    const c = await connected()
    const light = { themeName: 'Light Modern', mode: 'light' as const }
    expect(c.server.broadcast(editorBridge, { name: 'setTheme', payload: light })).toBe(1)
    await until(() => c.events.length === 2)
    expect(c.events.at(-1)).toEqual({ name: 'setTheme', payload: light })
  })

  it('re-sends hello after server restart on the same port', async () => {
    const first = await startEditorBridge()
    const { port, token } = first.server
    const { conn } = connectionFor(first.server)
    cleanups.push(() => conn.dispose())
    await conn.start(recordingHandlers().handlers)
    await first.server.close()
    const second = await startEditorBridge({ port, token })
    cleanups.push(() => second.server.close())
    await until(() => second.hellos.length === 1, 10_000)
    expect(second.hellos[0]?.hello.folderPath).toBe('/Work/Repo')
  })

  it('request rejects while offline', async () => {
    const c = await connected()
    await c.server.close()
    await new Promise((r) => setTimeout(r, 200))
    await expect(
      c.conn.request('languageStatus', { languageId: null, state: 'idle', errors: 0, warnings: 0 }),
    ).rejects.toBeInstanceOf(BridgeUnavailableError)
  })
})
