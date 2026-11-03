import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent, type ChatPartComponent } from '../../src/contract'
import { useChatSearch } from '../../src/renderer/hooks/use-chat-search'
import { ChatSearchBar } from '../../src/renderer/kit/ChatSearchBar'
import type { MessageListHandle } from '../../src/renderer/kit/parts/MessageList'
import { makeTranscript } from '../../testing'
import { user } from './parts/samples'
import { testI18n } from './support'

const Part: ChatPartComponent = () => null
const EVENTS: ChatEvent[] = [user('u1', 'alpha beta'), user('u2', 'gamma'), user('u3', 'beta beta')]

/** The search hook over three user messages and a mock virtualized list. */
function setup() {
  const list: MessageListHandle = { scrollToIndex: vi.fn(), rowElement: () => null, scrollToItem: () => false }
  const hook = renderHook(() =>
    useChatSearch({
      items: makeTranscript(EVENTS).items,
      parts: { message: Part },
      groupToolCalls: true,
      turnHeader: false,
      list: { current: list },
    }),
  )
  const key = (k: Partial<KeyboardEvent>, handler: 'onViewKeyDown' | 'onInputKeyDown') => {
    const e = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      ...k,
    }
    act(() => hook.result.current[handler](e as unknown as KeyboardEvent))
    return e
  }
  return { hook, list, key }
}

describe('in-chat search', () => {
  it('Mod+F opens; Enter scrolls to next and wraps; Shift+Enter goes back; Esc closes', () => {
    const { hook, list, key } = setup()
    expect(key({ key: 'f', metaKey: true }, 'onViewKeyDown').preventDefault).toHaveBeenCalled()
    expect(hook.result.current.open).toBe(true)
    act(() => hook.result.current.setQuery('BETA'))
    expect(hook.result.current.matches).toEqual([
      { rowIndex: 0, occurrence: 0 },
      { rowIndex: 2, occurrence: 0 },
      { rowIndex: 2, occurrence: 1 },
    ])
    expect(list.scrollToIndex).toHaveBeenLastCalledWith(0)
    key({ key: 'Enter' }, 'onInputKeyDown')
    expect(list.scrollToIndex).toHaveBeenLastCalledWith(2)
    key({ key: 'Enter' }, 'onInputKeyDown')
    key({ key: 'Enter' }, 'onInputKeyDown')
    expect(hook.result.current.current).toBe(0)
    key({ key: 'Enter', shiftKey: true }, 'onInputKeyDown')
    expect(hook.result.current.current).toBe(2)
    expect(key({ key: 'Escape' }, 'onInputKeyDown').stopPropagation).toHaveBeenCalled()
    expect(hook.result.current.open).toBe(false)
    expect(hook.result.current.query).toBe('')
  })

  it('other keys do not open it', () => {
    const { hook, key } = setup()
    key({ key: 'f' }, 'onViewKeyDown')
    key({ key: 'g', ctrlKey: true }, 'onViewKeyDown')
    expect(hook.result.current.open).toBe(false)
  })

  it('count "2 of 3"; no results', () => {
    const { hook, key } = setup()
    key({ key: 'f', ctrlKey: true }, 'onViewKeyDown')
    act(() => hook.result.current.setQuery('beta'))
    key({ key: 'Enter' }, 'onInputKeyDown')
    const view = render(
      <I18nextProvider i18n={testI18n}>
        <ChatSearchBar search={hook.result.current} />
      </I18nextProvider>,
    )
    expect(screen.getByTestId(CHAT_TESTIDS.searchCount)).toHaveTextContent('2 of 3')
    fireEvent.change(screen.getByTestId(CHAT_TESTIDS.searchInput), { target: { value: 'zzz' } })
    view.rerender(
      <I18nextProvider i18n={testI18n}>
        <ChatSearchBar search={hook.result.current} />
      </I18nextProvider>,
    )
    expect(screen.getByTestId(CHAT_TESTIDS.searchCount)).toHaveTextContent('No results')
  })
})
