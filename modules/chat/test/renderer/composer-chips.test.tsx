import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ComposerEntry } from '../../src/contract'
import { Composer } from '../../src/renderer/kit/composer/Composer'
import { useChatStore } from '../../src/renderer/session/store'
import { stubChatHost, stubSessionApi } from '../../testing'
import { renderChat } from './support'

const CHIP: ComposerEntry = {
  kind: 'chip',
  id: 'c1',
  text: 'Review comments:\n1. a.ts:1 fix',
  labels: ['a.ts:1', 'b.ts:2-3'],
}

/** A composer whose stub host already holds `entries` in its inbox. */
function renderWithInbox(entries: ComposerEntry[] = []) {
  const host = stubChatHost()
  for (const e of entries) host.pushInbox('s1', e)
  const s = stubSessionApi()
  renderChat(<Composer session={s.api} />, host)
  const input = screen.getByTestId(CHAT_TESTIDS.composerInput) as HTMLTextAreaElement
  return { ...s, host, input }
}

/** Pushes an entry while mounted, as `chat.composerInboxChanged` would. */
const deliver = (host: ReturnType<typeof stubChatHost>, e: ComposerEntry) =>
  act(() => {
    host.pushInbox('s1', e)
    useChatStore.getState().bumpInbox('s1')
  })

describe('composer chips (11c)', () => {
  it('chip entry renders a chip, not textarea text', async () => {
    const { input } = renderWithInbox([CHIP])
    const chip = await screen.findByTestId(CHAT_TESTIDS.composerChip)
    expect(chip).toHaveTextContent('2 review comments')
    expect(chip).toHaveAttribute('title', 'a.ts:1\nb.ts:2-3')
    expect(input.value).toBe('')
  })

  it('removing a chip drops it from the sent message', async () => {
    const { input, callsOf } = renderWithInbox([CHIP])
    await userEvent.click(await screen.findByTestId(CHAT_TESTIDS.composerChipRemove))
    expect(screen.queryByTestId(CHAT_TESTIDS.composerChip)).toBeNull()
    await userEvent.type(input, 'only this{Enter}')
    expect(callsOf('send')[0]?.args).toEqual([{ text: 'only this', images: [] }])
  })

  it('send puts the chip text first, then the typed text; chips clear', async () => {
    const { input, callsOf } = renderWithInbox([CHIP])
    await screen.findByTestId(CHAT_TESTIDS.composerChip)
    await userEvent.type(input, 'draft{Enter}')
    expect(callsOf('send')[0]?.args).toEqual([{ text: `${CHIP.text}\n\ndraft`, images: [] }])
    expect(screen.queryByTestId(CHAT_TESTIDS.composerChip)).toBeNull()
  })

  it('text entry appends after existing draft with a blank line', async () => {
    const { host, input } = renderWithInbox()
    await userEvent.type(input, 'mine')
    deliver(host, { kind: 'text', id: 't1', text: 'File.ts:3 fix' })
    await waitFor(() => expect(input.value).toBe('mine\n\nFile.ts:3 fix'))
  })

  it('nothing is sent without user action', async () => {
    const { host, callsOf } = renderWithInbox([CHIP])
    deliver(host, { kind: 'text', id: 't2', text: 'more' })
    await screen.findByTestId(CHAT_TESTIDS.composerChip)
    expect(callsOf('send')).toHaveLength(0)
  })
})
