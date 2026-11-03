import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatImage, type ComposerApi, type ComposerExtension } from '../../../src/contract'
import { Composer } from '../../../src/renderer/kit/composer/Composer'
import { stubChatHost, stubSessionApi } from '../../../testing'
import { renderChat } from '../support'

const IMAGE: ChatImage = { name: 'shot.png', mediaType: 'image/png', dataBase64: 'AAAA' }
const ADD_IMAGE = 'add-image'

/** A toolbar button that attaches `IMAGE` (stands in for a paste/drop). */
const imageExtension: ComposerExtension = {
  id: 'img',
  toolbar: ({ api }: { api: ComposerApi }) => (
    <button type="button" data-testid={ADD_IMAGE} onClick={() => api.addImages([IMAGE])}>
      +
    </button>
  ),
}

/** One chat view at a time, keyed by session like the agents center (switching remounts the composer). */
function setup() {
  const host = stubChatHost()
  const sessions = { s1: stubSessionApi([], { sessionId: 's1' }), s2: stubSessionApi([], { sessionId: 's2' }) }
  const ui = (id: keyof typeof sessions) => (
    <Composer key={id} session={sessions[id].api} extensions={[imageExtension]} />
  )
  const view = renderChat(ui('s1'), host)
  const input = () => screen.getByTestId(CHAT_TESTIDS.composerInput) as HTMLTextAreaElement
  return { host, sessions, input, show: (id: keyof typeof sessions) => view.rerender(ui(id)) }
}

describe('composer drafts per session', () => {
  it('switching to another chat and back restores the unsent draft; a chat with no draft is empty', async () => {
    const { input, show } = setup()
    await userEvent.type(input(), 'half-written')
    show('s2')
    expect(input().value).toBe('')
    await userEvent.type(input(), 'other')
    show('s1')
    expect(input().value).toBe('half-written')
    show('s2')
    expect(input().value).toBe('other')
  })

  it('keeps attached images per session', async () => {
    const { show, sessions, input } = setup()
    await userEvent.click(screen.getByTestId(ADD_IMAGE))
    show('s2')
    show('s1')
    await userEvent.type(input(), 'look{Enter}')
    expect(sessions.s1.callsOf('send')[0]?.args).toEqual([{ text: 'look', images: [IMAGE] }])
  })

  it("sending clears only that chat's draft", async () => {
    const { input, show, sessions } = setup()
    await userEvent.type(input(), 'keep me')
    show('s2')
    await userEvent.type(input(), 'go{Enter}')
    expect(sessions.s2.callsOf('send')).toHaveLength(1)
    expect(input().value).toBe('')
    show('s1')
    expect(input().value).toBe('keep me')
  })

  it('review-comment chips survive switching away and back', async () => {
    const { host, show } = setup()
    host.pushInbox('s2', { kind: 'chip', id: 'c1', text: 'Review comments:\n1. a.ts:1 fix', labels: ['a.ts:1'] })
    show('s2')
    await screen.findByTestId(CHAT_TESTIDS.composerChip)
    show('s1')
    expect(screen.queryByTestId(CHAT_TESTIDS.composerChip)).toBeNull()
    show('s2')
    expect(screen.getByTestId(CHAT_TESTIDS.composerChip)).toBeInTheDocument()
  })
})
