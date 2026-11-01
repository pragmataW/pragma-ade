/** Shared renderer test setup: a fake RendererContext, the real store and an i18n provider with `browser`. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CommentComposerProps, CommentsUiService } from '@pragma/module-comments/contract'
import { CommentsUiServiceToken } from '@pragma/module-comments/contract'
import type { IpcContract, IpcEventContract, ServiceToken } from '@pragma/sdk'
import { act, cleanup, render } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, vi } from 'vitest'
import type { BrowserPick, BrowserSettings, BrowserSnapshot } from '../../src/contract'
import { BrowserIpc } from '../../src/contract'
import { browserSettingsDefaults } from '../../src/main/settings'
import { type BrowserRuntime, setRuntime } from '../../src/renderer/runtime'
import { createBrowserStore } from '../../src/renderer/store'

afterEach(() => {
  cleanup()
  setRuntime(undefined)
})

export const en = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'locales', 'en.json'), 'utf8'))
const i18n = i18next.createInstance()
void i18n.use(initReactI18next).init({ lng: 'en', ns: ['browser'], resources: { en: { browser: en } } })
/** `en.json` text with `{{x}}` filled in. */
export const text = (key: string, params: Record<string, unknown> = {}) => i18n.t(`browser:${key}`, params)

export interface FakeComposer {
  props: CommentComposerProps[]
}

const recorded: CommentComposerProps[][] = []

/** Records its props into the newest `fakeCommentsUi()`'s list. */
function RecordingComposer(p: CommentComposerProps) {
  recorded.at(-1)?.push(p)
  return <div data-testid="fake-composer" />
}

/** A CommentsUi whose composer records its props. */
export function fakeCommentsUi(): CommentsUiService & FakeComposer {
  const props: CommentComposerProps[] = []
  recorded.push(props)
  return { props, CommentComposer: RecordingComposer, openDrawer: vi.fn(), send: vi.fn() }
}

export function fakeRendererCtx(
  opts: { comments?: CommentsUiService | null; settings?: Partial<BrowserSettings> } = {},
) {
  const calls: { channel: string; input: unknown }[] = []
  const listeners = new Map<string, (p: unknown) => void>()
  const replies = new Map<string, unknown>()
  let settings: BrowserSettings = { ...browserSettingsDefaults, ...opts.settings }
  const settingsListeners = new Set<(s: BrowserSettings) => void>()
  const services = new Map<string, unknown>()
  if (opts.comments !== null) services.set(CommentsUiServiceToken.id, opts.comments ?? fakeCommentsUi())
  const ctx = {
    ipc: {
      invoke: vi.fn(async (c: IpcContract<unknown, unknown>, input: unknown) => {
        calls.push({ channel: c.channel, input })
        return replies.get(c.channel) ?? {}
      }),
      subscribe: (c: IpcEventContract<unknown>, cb: (p: unknown) => void) => {
        listeners.set(c.channel, cb)
        return { dispose: () => listeners.delete(c.channel) }
      },
    },
    services: {
      tryGet: (t: ServiceToken<unknown>) => services.get(t.id),
      get: (t: ServiceToken<unknown>) => services.get(t.id),
    },
    settings: {
      get: () => settings,
      subscribe: (cb: (s: BrowserSettings) => void) => {
        settingsListeners.add(cb)
        return { dispose: () => settingsListeners.delete(cb) }
      },
      update: vi.fn(async (patch: Partial<BrowserSettings>) => {
        settings = { ...settings, ...patch }
        for (const cb of settingsListeners) cb(settings)
        return settings
      }),
    },
    panels: { activateRightTab: vi.fn(), registerRightTab: vi.fn(), setBadge: vi.fn() },
  }
  return { ctx: ctx as unknown as BrowserRuntime['ctx'], raw: ctx, calls, replies, listeners }
}

/** Sets the runtime (fake ctx + real store) and renders `ui`; `emit` delivers a main → renderer event. */
export function renderBrowser(
  ui: ReactElement,
  opts: Parameters<typeof fakeRendererCtx>[0] & { snapshot?: BrowserSnapshot } = {},
) {
  const fake = fakeRendererCtx(opts)
  if (opts.snapshot) fake.replies.set(BrowserIpc.getSnapshot.channel, opts.snapshot)
  const store = createBrowserStore(fake.ctx.ipc)
  setRuntime({ ctx: fake.ctx, store })
  if (opts.snapshot) store.getState().applySnapshot(opts.snapshot)
  const result = render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
  const emit = (c: IpcEventContract<unknown>, payload: unknown) =>
    act(() => {
      fake.listeners.get(c.channel)?.(payload)
    })
  const pick = (p: BrowserPick) => emit(BrowserIpc.picked, p)
  return { ...result, ...fake, store, emit, pick }
}
