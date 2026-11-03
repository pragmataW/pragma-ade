import { describe, expect, it } from 'vitest'
import { type ChatFile, type ChatSessionAction, chatIpc } from '../../src/contract'
import { registerChatIpc } from '../../src/main/ipc-handlers'
import { ActionUnsupportedError } from '../../src/main/session-actions'
import { fakeIpc, harness } from './harness'

const pdf: ChatFile = { name: 'spec.pdf', mediaType: 'application/pdf', dataBase64: 'JVBE' }
const notes: ChatFile = { name: 'notes.md', mediaType: 'text/markdown', dataBase64: 'IyBh' }

describe('session actions', () => {
  it('lists the implemented actions in session-info after the handshake', async () => {
    const h = harness({ actions: ['stopTask', 'toggleMcp'] })
    const c = await h.attached()
    expect(c.snapshot().transcript.info.actions).toEqual(['toggleMcp', 'stopTask'])
  })

  it('emits no actions session-info when the handle implements none', async () => {
    const h = harness()
    const c = await h.attached()
    expect(c.snapshot().transcript.info.actions).toEqual([])
    expect(h.published.filter((p) => p.event.kind === 'session-info')).toHaveLength(1)
  })

  it.each<[ChatSessionAction, unknown[]]>([
    [{ action: 'toggleMcp', name: 'db', enabled: false }, ['toggleMcp', 'db', false]],
    [{ action: 'reconnectMcp', name: 'db' }, ['reconnectMcp', 'db']],
    [{ action: 'rewind', messageId: 'm1' }, ['rewind', 'm1']],
    [{ action: 'stopTask', taskId: 't1' }, ['stopTask', 't1']],
    [{ action: 'fork', messageId: 'm2' }, ['fork', 'm2']],
  ])('%o calls the handle method', async (action, call) => {
    const h = harness({ actions: ['toggleMcp', 'reconnectMcp', 'rewind', 'stopTask', 'fork'] })
    const c = await h.attached()
    await c.action(action)
    expect(h.fake.lastSession().actionCalls).toEqual([call])
  })

  it('refreshMcp emits the listed servers as mcp-status', async () => {
    const h = harness({ actions: ['refreshMcp'] })
    const c = await h.attached()
    h.fake.lastSession().mcpServers = [{ name: 'github', status: 'connected', toolCount: 3 }]
    await c.action({ action: 'refreshMcp' })
    expect(c.snapshot().transcript.mcpServers).toEqual([{ name: 'github', status: 'connected', toolCount: 3 }])
  })

  it('rejects an action the handle lacks, and any action without a live handle', async () => {
    const h = harness({ actions: ['stopTask'] })
    const c = await h.attached()
    await expect(c.action({ action: 'fork' })).rejects.toBeInstanceOf(ActionUnsupportedError)
    await expect(h.controller().action({ action: 'stopTask', taskId: 't' })).rejects.toBeInstanceOf(
      ActionUnsupportedError,
    )
  })

  it('chat.action routes to the controller', async () => {
    const h = harness({ actions: ['stopTask'] })
    const c = await h.attached()
    const ipc = fakeIpc()
    registerChatIpc(ipc, {
      registry: { open: async () => c } as never,
      agents: { getSession: async () => null, getWorktreePath: async () => null },
      search: async () => [],
      checkSupport: async () => ({ ok: true }),
      takeInbox: () => [],
      capability: () => undefined,
    })
    await ipc.invoke(chatIpc.action, { sessionId: h.session.id, action: { action: 'stopTask', taskId: 't9' } })
    expect(h.fake.lastSession().actionCalls).toEqual([['stopTask', 't9']])
  })
})

describe('document attachments', () => {
  it('drops documents the provider does not accept; the message lists what was sent', async () => {
    const h = harness()
    const c = await h.attached()
    await c.send({ text: 'read', images: [], files: [pdf] })
    expect(h.fake.lastSession().sent[0]?.files).toEqual([])
    expect(c.snapshot().transcript.items[0]).toMatchObject({ kind: 'message', attachments: [] })
  })

  it('passes accepted kinds through and records them on the user message', async () => {
    const h = harness({ attachmentKinds: ['image', 'pdf'] })
    const c = await h.attached()
    await c.send({ text: 'read', images: [], files: [pdf, notes] })
    expect(h.fake.lastSession().sent[0]?.files).toEqual([pdf])
    expect(c.snapshot().transcript.items[0]).toMatchObject({
      attachments: [{ kind: 'pdf', name: 'spec.pdf', mediaType: 'application/pdf' }],
    })
  })
})
