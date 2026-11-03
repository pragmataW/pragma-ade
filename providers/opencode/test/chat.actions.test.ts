import { afterEach, describe, expect, it } from 'vitest'
import { CUSTOM } from '../src/renderer/chat/payloads'
import {
  chatSetup,
  cleanupAll,
  lastBody,
  ofKind,
  requestsOf,
  until,
  waitForEvent,
} from '../testing/fake-opencode-server/harness'

afterEach(cleanupAll)

const notices = (events: Parameters<typeof ofKind>[0]) =>
  ofKind(events, 'custom')
    .filter((c) => c.type === CUSTOM.notice)
    .map((c) => c.data)

describe('opencode chat session actions', () => {
  it('rewind reverts to before the transcript message (mapped to OpenCode’s id) and commits', async () => {
    const s = chatSetup({ scenario: 'revert' })
    const h = await s.start()
    await h.send({ text: 'edit a', images: [] }, { messageId: 'chat-msg-1' })
    await waitForEvent(s.events, 'turn-end')
    await h.rewind?.('chat-msg-1')
    const staged = lastBody(s.h.log, /\/revert\/stage$/) as { messageID: string; files: boolean }
    expect(staged).toMatchObject({ files: true })
    expect(staged.messageID).toMatch(/^msg_/)
    expect(requestsOf(s.h.log, /\/revert\/commit$/)).toHaveLength(1)
    expect(notices(s.events)).toEqual([{ notice: 'reverted', messageId: 'chat-msg-1', files: ['src/a.ts'] }])
  })

  it('fork continues in a copy: new external id in session-info, later prompts go there', async () => {
    const s = chatSetup({ scenario: 'revert' })
    const h = await s.start()
    const original = h.externalSessionId
    await h.fork?.()
    expect(h.externalSessionId).not.toBe(original)
    expect(ofKind(s.events, 'session-info').at(-1)?.externalSessionId).toBe(h.externalSessionId)
    expect(notices(s.events)).toEqual([{ notice: 'forked', from: original, to: h.externalSessionId }])
    await h.send({ text: 'after fork', images: [] })
    await waitForEvent(s.events, 'turn-end')
    expect(requestsOf(s.h.log, /\/prompt$/).map((r) => r.path)).toEqual([`/api/session/${h.externalSessionId}/prompt`])
  })

  it('mcp-status at start; toggle and reconnect go to the server and refresh the list', async () => {
    const s = chatSetup({ scenario: 'mcp' })
    const h = await s.start()
    const first = await waitForEvent(s.events, 'mcp-status')
    expect(first.servers).toEqual([
      { name: 'github', status: 'connected' },
      { name: 'db', status: 'failed', error: 'ECONNREFUSED' },
      { name: 'linear', status: 'needs-auth', error: 'Sign in required' },
    ])
    await h.toggleMcp?.('github', false)
    await until(() => ofKind(s.events, 'mcp-status').at(-1)?.servers[0]?.status === 'disabled')
    await h.reconnectMcp?.('db')
    await until(() => ofKind(s.events, 'mcp-status').at(-1)?.servers[1]?.status === 'connected')
    expect(requestsOf(s.h.log, /\/api\/experimental\/mcp\//).map((r) => r.path)).toEqual([
      '/api/experimental/mcp/github/disconnect',
      '/api/experimental/mcp/db/connect',
    ])
    expect(await h.listMcp?.()).toHaveLength(3)
  })

  it('no MCP list on servers without one (older builds): no mcp-status', async () => {
    const s = chatSetup()
    await s.start()
    await new Promise((r) => setTimeout(r, 100))
    expect(ofKind(s.events, 'mcp-status')).toEqual([])
  })
})
