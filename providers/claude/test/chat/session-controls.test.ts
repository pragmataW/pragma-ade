import { describe, expect, it } from 'vitest'
import { createClaudeChatCapability } from '../../src/main/chat/capability'
import * as F from './frames'
import { isKind, ofKind, startSession } from './support'

const requestsOf = (s: Awaited<ReturnType<typeof startSession>>) => s.report()?.controlRequests.map((f) => f.request)
const b64 = (text: string) => Buffer.from(text).toString('base64')

describe('ClaudeChatSession controls (fake CLI)', () => {
  it('MCP: the detailed server list after the handshake and after each init', async () => {
    const s = await startSession('mcp-status')
    const first = await s.waitForEvent(isKind('mcp-status'))
    expect(first).toEqual({
      kind: 'mcp-status',
      servers: [
        { name: 'github', status: 'connected', toolCount: 2, scope: 'user' },
        { name: 'linear', status: 'needs-auth', scope: 'project' },
        { name: 'postgres', status: 'failed', error: 'spawn pg-mcp ENOENT', scope: 'local' },
      ],
    })
    await s.send('hi')
    await s.waitForEvent(isKind('turn-end'))
    const lists = ofKind(s.events, 'mcp-status')
    expect(lists.length).toBeGreaterThanOrEqual(3)
    await expect.poll(() => ofKind(s.events, 'mcp-status').at(-1)).toEqual(first)
  })

  it('toggleMcp / reconnectMcp send their control requests and refresh the list', async () => {
    const s = await startSession('mcp-status')
    await s.session.toggleMcp('github', false)
    await s.session.reconnectMcp('postgres')
    expect(requestsOf(s)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subtype: 'mcp_toggle', serverName: 'github', enabled: false }),
        expect.objectContaining({ subtype: 'mcp_reconnect', serverName: 'postgres' }),
      ]),
    )
    expect(await s.session.listMcp()).toHaveLength(3)
  })

  it('no MCP servers → no empty mcp-status', async () => {
    const s = await startSession('basic')
    await s.send('hi')
    await s.waitForEvent(isKind('turn-end'))
    expect(s.events.find(isKind('mcp-status'))).toBeUndefined()
  })

  it('each user turn carries a uuid; rewind(uuid) sends rewind_files for it', async () => {
    const s = await startSession('basic')
    await s.send('hi')
    await s.waitForEvent(isKind('turn-end'))
    const uuid = String(s.report()?.userMessages[0]?.frame.uuid)
    expect(uuid).toMatch(/^[0-9a-f-]{36}$/)
    await s.session.rewind(uuid)
    expect(requestsOf(s)).toContainEqual(expect.objectContaining({ subtype: 'rewind_files', user_message_id: uuid }))
  })

  it('PDF and text files become document blocks (text decoded to a plain-text source)', async () => {
    const s = await startSession('basic')
    await s.session.send({
      text: 'read these',
      images: [],
      files: [
        { name: 'spec.pdf', mediaType: 'application/pdf', dataBase64: b64('%PDF-1.4') },
        { name: 'notes.md', mediaType: 'text/markdown', dataBase64: b64('# Notes ü') },
      ],
    })
    await s.waitForEvent(isKind('turn-end'))
    const message = s.report()?.userMessages[0]?.frame.message as { content: unknown[] }
    expect(message.content.slice(1)).toEqual([
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: b64('%PDF-1.4') },
        title: 'spec.pdf',
      },
      { type: 'document', source: { type: 'text', media_type: 'text/plain', data: '# Notes ü' }, title: 'notes.md' },
    ])
  })

  it('the capability accepts images, PDFs and text files', () => {
    const cap = createClaudeChatCapability({ log: { info() {}, warn() {} } as never, resolveCommand: async () => null })
    expect(cap.attachmentKinds).toEqual(['image', 'pdf', 'text'])
  })

  it('history: document blocks of a user turn become pdf / text attachment chips', () => {
    const doc = (media_type: string, title?: string) => ({ type: 'document', source: { media_type }, title })
    const [message] = F.mapAll(
      [F.userText('u1', [{ type: 'text', text: 'see' }, doc('application/pdf', 'a.pdf'), doc('text/plain')])],
      { origin: 'history' },
    )
    expect(message).toMatchObject({
      attachments: [
        { kind: 'pdf', name: 'a.pdf', mediaType: 'application/pdf' },
        { kind: 'text', name: 'document', mediaType: 'text/plain' },
      ],
    })
  })
})
