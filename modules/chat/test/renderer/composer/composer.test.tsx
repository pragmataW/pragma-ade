import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  CHAT_TESTIDS,
  type ChatEvent,
  type ComposerExtension,
  type ComposerMenuProps,
  MAX_IMAGE_BYTES,
} from '../../../src/contract'
import { Composer } from '../../../src/renderer/kit/composer/Composer'
import { defaultComposerExtensions } from '../../../src/renderer/kit/composer/extensions'
import { MenuList } from '../../../src/renderer/kit/composer/MenuList'
import { readImageFiles } from '../../../src/renderer/kit/composer/read-images'
import { useChatStore } from '../../../src/renderer/session/store'
import { stubSessionApi } from '../../../testing'
import { renderChat } from '../support'

const commands: ChatEvent = {
  kind: 'session-info',
  commands: [
    { name: 'review', description: 'Review changes' },
    { name: 'compact', description: 'Compact' },
  ],
}

function renderComposer(
  events: ChatEvent[] = [commands],
  extensions: ComposerExtension[] = defaultComposerExtensions,
  files: string[] = [],
) {
  const s = stubSessionApi(events, { files })
  renderChat(<Composer session={s.api} extensions={extensions} />)
  return { ...s, input: screen.getByTestId(CHAT_TESTIDS.composerInput) as HTMLTextAreaElement }
}

const HashMenu = (props: ComposerMenuProps) => (
  <MenuList items={[{ key: 'x', label: `#${props.query}`, insert: '#issue-1 ' }]} props={props} />
)
const hashExtension: ComposerExtension = { id: 'hash', trigger: { char: '#', menu: HashMenu } }

describe('Composer', () => {
  it('Enter sends, Shift+Enter newline, composing never sends', async () => {
    const { input, callsOf } = renderComposer()
    await userEvent.type(input, 'one{Shift>}{Enter}{/Shift}two')
    expect(input.value).toBe('one\ntwo')
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(callsOf('send')).toHaveLength(0)
    await userEvent.type(input, '{Enter}')
    expect(callsOf('send')[0]?.args).toEqual([{ text: 'one\ntwo', images: [] }])
    expect(input.value).toBe('')
    await userEvent.type(input, '   {Enter}')
    expect(callsOf('send')).toHaveLength(1)
  })

  it('slash menu filters by prefix, Tab inserts', async () => {
    const { input } = renderComposer()
    await userEvent.type(input, '/re')
    const items = screen.getAllByTestId(CHAT_TESTIDS.composerMenuItem)
    expect(items.map((i) => i.textContent)).toEqual([expect.stringContaining('/review')])
    await userEvent.keyboard('{Tab}')
    expect(input.value).toBe('/review ')
    expect(screen.queryByTestId(CHAT_TESTIDS.composerMenu)).toBeNull()
  })

  it('@ap queries searchFiles debounced and inserts path', async () => {
    const { input, callsOf } = renderComposer([commands], defaultComposerExtensions, ['src/app.ts', 'docs/apple.md'])
    await userEvent.type(input, 'see @ap')
    await waitFor(() => expect(screen.getAllByTestId(CHAT_TESTIDS.composerMenuItem)).toHaveLength(2))
    expect(callsOf('searchFiles').map((c) => c.args[0])).toEqual(['ap'])
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(input.value).toBe('see @docs/apple.md ')
  })

  it('custom extension trigger opens its menu', async () => {
    const { input, callsOf } = renderComposer([], [hashExtension])
    await userEvent.type(input, 'fix #12')
    expect(screen.getByTestId(CHAT_TESTIDS.composerMenuItem)).toHaveTextContent('#12')
    await userEvent.keyboard('{Enter}')
    expect(input.value).toBe('fix #issue-1 ')
    expect(callsOf('send')).toHaveLength(0)
  })

  it('Esc closes the menu without interrupting', async () => {
    const { input, callsOf } = renderComposer()
    await userEvent.type(input, '/')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId(CHAT_TESTIDS.composerMenu)).toBeNull()
    expect(callsOf('interrupt')).toHaveLength(0)
  })

  it('send during working shows a queue chip; remove calls cancelQueued', async () => {
    const { input, callsOf } = renderComposer([
      { kind: 'turn-start', turnId: 't' },
      { kind: 'queue', queued: [{ id: 'q1', text: 'later' }] },
    ])
    expect(screen.getByTestId(CHAT_TESTIDS.queueChip)).toHaveTextContent('later')
    await userEvent.type(input, 'more{Enter}')
    expect(callsOf('send')).toHaveLength(1)
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.queueChipRemove))
    expect(callsOf('cancelQueued')[0]?.args).toEqual(['q1'])
  })

  it('composerAppend text appended, not sent', async () => {
    const { input, callsOf } = renderComposer()
    await userEvent.type(input, 'mine')
    act(() => {
      useChatStore.getState().pushComposerAppend('s1', 'File.ts:3 fix')
    })
    await waitFor(() => expect(input.value).toBe('mine\nFile.ts:3 fix'))
    expect(callsOf('send')).toHaveLength(0)
  })

  it('readImageFiles rejects >5MB and non-images', async () => {
    const ok = new File(['png'], 'a.png', { type: 'image/png' })
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'b.png', { type: 'image/png' })
    const text = new File(['x'], 'c.txt', { type: 'text/plain' })
    const { images, rejected } = await readImageFiles([ok, big, text])
    expect(images).toEqual([{ name: 'a.png', mediaType: 'image/png', dataBase64: btoa('png') }])
    expect(rejected.map((f) => f.name)).toEqual(['b.png', 'c.txt'])
  })
})
