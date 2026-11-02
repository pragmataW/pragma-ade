import { AGENT_SLOTS } from '@pragma/module-agents/contract'
import { ShellSlots } from '@pragma/sdk'
import type { RendererContext, SettingsPage, SlotEntry } from '@pragma/sdk/renderer'
import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent } from '../../src/contract'
import chatRenderer from '../../src/renderer'
import { useChatStore } from '../../src/renderer/session/store'
import { StatusbarContext } from '../../src/renderer/view/StatusbarContext'
import { makeSession, makeTranscript } from '../../testing'
import { renderChat } from './support'

function activate() {
  const slots: Record<string, SlotEntry<never>[]> = {}
  const pages: SettingsPage[] = []
  const ctx = {
    slots: {
      register: (id: string, e: SlotEntry<never>) => {
        slots[id] = [...(slots[id] ?? []), e]
        return { dispose: () => undefined }
      },
    },
    settingsPages: { register: (p: SettingsPage) => void pages.push(p) },
    ipc: { subscribe: () => ({ dispose: () => undefined }) },
    providers: { providersWithRenderer: () => [], rendererCapability: () => undefined },
  } as unknown as RendererContext<never>
  chatRenderer.activate(ctx)
  return { slots, pages }
}

const usage: ChatEvent = {
  kind: 'usage',
  inputTokens: 1,
  outputTokens: 1,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  contextTokens: 50_000,
  contextWindow: 200_000,
}

describe('chat renderer module', () => {
  it.each([
    ['chat', true],
    ['terminal', false],
  ])('agentSession.view match is %s for mode %s', (mode, expected) => {
    const view = activate().slots[AGENT_SLOTS.view]?.[0] as SlotEntry<{ session: unknown; active: boolean }>
    expect(view.match?.({ session: makeSession({ mode }), active: true })).toBe(expected)
  })

  it('settings page registered with order 120; launcher option and status bar entries exist', () => {
    const { slots, pages } = activate()
    expect(pages[0]).toMatchObject({ id: 'chat', titleKey: 'chat:settings.title', order: 120 })
    expect(slots[AGENT_SLOTS.launcherOptions]).toHaveLength(1)
    expect(slots[ShellSlots.statusbarRight]).toHaveLength(1)
  })

  it("StatusbarContext shows the active chat session's context percent and renders nothing without an active chat session", () => {
    renderChat(<StatusbarContext />)
    expect(screen.queryByTestId(CHAT_TESTIDS.statusbarContext)).toBeNull()
    act(() => {
      useChatStore.getState().hydrate('s1', { providerId: 'fake', transcript: makeTranscript([usage]), status: 'idle' })
      useChatStore.getState().setActive('s1')
    })
    expect(screen.getByTestId(CHAT_TESTIDS.statusbarContext)).toHaveTextContent('Context 25%')
    act(() => useChatStore.getState().setActive(null))
    expect(screen.queryByTestId(CHAT_TESTIDS.statusbarContext)).toBeNull()
  })
})
