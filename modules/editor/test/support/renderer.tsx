/** Renderer test setup: a recording fake of the editor's RendererContext slice and an `editor` i18n instance. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProjectsRendererServiceToken } from '@pragma/module-projects/contract'
import type { IpcEventContract } from '@pragma/sdk'
import { act, cleanup, render } from '@testing-library/react'
import i18next, { type i18n as I18n } from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, vi } from 'vitest'
import { type EditorSettings, editorSettingsDefaults } from '../../src/contract'
import { type EditorRendererRuntime, setEditorRendererRuntime } from '../../src/renderer/runtime'

afterEach(() => {
  cleanup()
  setEditorRendererRuntime(undefined)
})

const LOCALE = join(import.meta.dirname, '..', '..', 'locales', 'en.json')

function editorI18n(): I18n {
  const instance = i18next.createInstance()
  void instance.use(initReactI18next).init({
    lng: 'en',
    ns: ['editor'],
    resources: { en: { editor: JSON.parse(readFileSync(LOCALE, 'utf8')) } },
  })
  return instance
}
const i18n = editorI18n()
export const text = (key: string, params: Record<string, unknown> = {}): string => i18n.t(`editor:${key}`, params)

type Worktree = { id: string; path: string } | null

class FakeEditorCtx {
  readonly calls: { channel: string; input: unknown }[] = []
  readonly replies = new Map<string, unknown>()
  readonly events = new Map<string, (p: unknown) => void>()
  readonly panels = { activateRightTab: vi.fn(), registerRightTab: vi.fn(), setBadge: vi.fn() }
  #settings: EditorSettings = { ...editorSettingsDefaults }
  readonly #watchers: ((s: EditorSettings) => void)[] = []
  readonly #active: Worktree

  constructor(active: Worktree) {
    this.#active = active
  }

  readonly ipc = {
    invoke: async ({ channel }: { channel: string }, input: unknown) => {
      this.calls.push({ channel, input })
      return this.replies.has(channel) ? this.replies.get(channel) : null
    },
    subscribe: ({ channel }: { channel: string }, cb: (p: unknown) => void) => {
      this.events.set(channel, cb)
      return { dispose: () => void this.events.delete(channel) }
    },
  }

  readonly services = {
    get: (token: { id: string }) =>
      token.id === ProjectsRendererServiceToken.id
        ? { subscribe: () => () => undefined, getActiveWorktree: () => this.#active }
        : undefined,
  }

  readonly settings = {
    get: () => this.#settings,
    subscribe: (cb: (s: EditorSettings) => void) => {
      this.#watchers.push(cb)
      return { dispose: () => undefined }
    },
    update: async (patch: Partial<EditorSettings>) => {
      this.#settings = { ...this.#settings, ...patch }
      for (const w of this.#watchers) w(this.#settings)
      return this.#settings
    },
  }
}

/** Installs a fake runtime, renders `ui`; `emit` delivers a main → renderer event. */
export async function renderEditor(
  ui: ReactElement,
  opts: { activeWorktree?: Worktree; replies?: Record<string, unknown> } = {},
) {
  const fake = new FakeEditorCtx(
    opts.activeWorktree === undefined ? { id: 'w1', path: '/work/one' } : opts.activeWorktree,
  )
  for (const [channel, value] of Object.entries(opts.replies ?? {})) fake.replies.set(channel, value)
  setEditorRendererRuntime({ ctx: fake as unknown as EditorRendererRuntime['ctx'] })
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
  })
  const emit = (c: IpcEventContract<unknown>, payload: unknown) => act(() => fake.events.get(c.channel)?.(payload))
  return { view, calls: fake.calls, emit, fake }
}
