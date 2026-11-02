import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentSession } from '@pragma/module-agents/contract'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type ChangedEvent, type SwitchEligibility, type SwitchResult, CHAT_SWITCH_TESTIDS as T } from '../src/contract'
import { type SwitchClient, SwitchClientProvider } from '../src/renderer/switch-client'
import { ViewToggle } from '../src/renderer/ViewToggle'
import { makeSession } from './support'

afterEach(cleanup)

const i18n = i18next.createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: { 'chat-switch': JSON.parse(readFileSync(join(import.meta.dirname, '..', 'locales', 'en.json'), 'utf8')) },
  },
  interpolation: { escapeValue: false },
})

const OK = { ok: true } as const
const ID_UNKNOWN = { ok: false, reasonKey: 'chat-switch:reason.idUnknown' } as const

function stubClient(o: { eligibility?: SwitchEligibility; result?: SwitchResult; confirm?: boolean } = {}) {
  const changed = new Set<(e: ChangedEvent) => void>()
  const conflict = new Set<(e: { sessionId: string; ownerSessionId: string }) => void>()
  const sub =
    <T,>(set: Set<T>) =>
    (cb: T) => {
      set.add(cb)
      return { dispose: () => void set.delete(cb) }
    }
  const client = {
    eligibility: vi.fn(async () => o.eligibility ?? { terminal: OK, chat: OK }),
    switchTo: vi.fn(async (sessionId: string) => o.result ?? { ok: true as const, sessionId }),
    onChanged: sub(changed),
    onConflict: sub(conflict),
    confirm: vi.fn(async () => o.confirm ?? true),
    emitChanged: (e: ChangedEvent) =>
      act(() => {
        for (const cb of changed) cb(e)
      }),
    emitConflict: (e: { sessionId: string; ownerSessionId: string }) =>
      act(() => {
        for (const cb of conflict) cb(e)
      }),
  } satisfies SwitchClient & Record<string, unknown>
  return client
}

function renderToggle(session: AgentSession, client = stubClient()) {
  render(
    <I18nextProvider i18n={i18n}>
      <SwitchClientProvider value={client}>
        <ViewToggle session={session} />
      </SwitchClientProvider>
    </I18nextProvider>,
  )
  return client
}

const item = (id: string) => screen.getByTestId(id)

describe('Chat | Terminal toggle', () => {
  it.each([
    ['chat', T.toChat],
    ['terminal', T.toTerminal],
  ])('pressed item follows session.mode (%s)', async (mode, pressed) => {
    renderToggle(makeSession({ mode }))
    await waitFor(() => expect(item(pressed)).toHaveAttribute('data-state', 'on'))
  })

  it('ineligible target disabled with reason tooltip', async () => {
    renderToggle(makeSession({ mode: 'terminal' }), stubClient({ eligibility: { terminal: OK, chat: ID_UNKNOWN } }))
    await waitFor(() => expect(item(T.toChat)).toBeDisabled())
    expect(item(T.toChat).parentElement).toHaveAttribute('title', 'The agent has not reported its session ID yet.')
  })

  it('to chat confirms; cancel sends nothing; confirm invokes switch {target: chat}', async () => {
    const cancel = renderToggle(makeSession({ mode: 'terminal' }), stubClient({ confirm: false }))
    await waitFor(() => expect(item(T.toChat)).toBeEnabled())
    await userEvent.click(item(T.toChat))
    expect(cancel.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ titleKey: 'chat-switch:confirm.toChat.title' }),
    )
    expect(cancel.switchTo).not.toHaveBeenCalled()
    cleanup()
    const ok = renderToggle(makeSession({ mode: 'terminal' }))
    await waitFor(() => expect(item(T.toChat)).toBeEnabled())
    await userEvent.click(item(T.toChat))
    expect(ok.switchTo).toHaveBeenCalledWith('s1', 'chat')
  })

  it.each([
    ['idle', false],
    ['working', true],
    ['waiting', true],
  ] as const)('%s to terminal confirms = %s', async (status, confirms) => {
    const c = renderToggle(makeSession({ mode: 'chat', status }))
    await waitFor(() => expect(item(T.toTerminal)).toBeEnabled())
    await userEvent.click(item(T.toTerminal))
    expect(c.confirm).toHaveBeenCalledTimes(confirms ? 1 : 0)
    expect(c.switchTo).toHaveBeenCalledWith('s1', 'terminal')
  })

  it('refetches on changed; switching shows a spinner and disables both items', async () => {
    const c = renderToggle(makeSession({ mode: 'chat' }))
    await waitFor(() => expect(c.eligibility).toHaveBeenCalledTimes(1))
    c.emitChanged({ sessionId: 's1', phase: 'switching' })
    expect(screen.getByTestId(T.spinner)).toBeInTheDocument()
    expect(item(T.toTerminal)).toBeDisabled()
    expect(item(T.toChat)).toBeDisabled()
    c.emitChanged({ sessionId: 'other', phase: 'switching' })
    expect(screen.getByTestId(T.spinner)).toBeInTheDocument()
    c.emitChanged({ sessionId: 's1', phase: 'idle' })
    await waitFor(() => expect(c.eligibility).toHaveBeenCalledTimes(4))
    expect(screen.queryByTestId(T.spinner)).toBeNull()
  })

  it('failure shows an inline alert', async () => {
    renderToggle(
      makeSession({ mode: 'chat' }),
      stubClient({ result: { ok: false, errorKey: 'chat-switch:error.busy' } }),
    )
    await waitFor(() => expect(item(T.toTerminal)).toBeEnabled())
    await userEvent.click(item(T.toTerminal))
    expect(await screen.findByTestId(T.alert)).toHaveTextContent(
      'This conversation is already running in another session.',
    )
  })

  it('a conflict for this session shows the conflict alert', async () => {
    const c = renderToggle(makeSession({ mode: 'terminal' }))
    c.emitConflict({ sessionId: 's1', ownerSessionId: 's2' })
    expect(screen.getByTestId(T.alert)).toHaveTextContent('This conversation is already running in another session.')
  })

  it('a fresh start shows the info notice (from the result or from a changed event of this session)', async () => {
    const noticeKey = 'chat-switch:notice.fresh.terminal'
    renderToggle(makeSession({ mode: 'chat' }), stubClient({ result: { ok: true, sessionId: 's1', noticeKey } }))
    await waitFor(() => expect(item(T.toTerminal)).toBeEnabled())
    await userEvent.click(item(T.toTerminal))
    expect(await screen.findByTestId(T.notice)).toHaveTextContent(
      'No previous conversation to continue — started a new terminal session.',
    )
    expect(screen.queryByTestId(T.alert)).toBeNull()
  })

  it('a changed event with a notice for another session shows nothing', async () => {
    const c = renderToggle(makeSession({ mode: 'chat' }))
    c.emitChanged({ sessionId: 'other', phase: 'idle', noticeKey: 'chat-switch:notice.fresh.chat' })
    expect(screen.queryByTestId(T.notice)).toBeNull()
    c.emitChanged({ sessionId: 's1', phase: 'idle', noticeKey: 'chat-switch:notice.fresh.chat' })
    expect(screen.getByTestId(T.notice)).toHaveTextContent('No previous conversation to continue — started a new chat.')
  })
})
