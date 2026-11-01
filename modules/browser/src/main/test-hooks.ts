import { defineTestHooks } from '@pragma/sdk/main'
import {
  type KeyboardInputEvent,
  type MouseInputEvent,
  session,
  type WebContents,
  type WebContentsView,
} from 'electron'
import { PICKER_WORLD_ID } from '../constants'
import type { BrowserSnapshot } from '../contract'
import { partitionForWorktree } from './partition'
import { getMainRuntime } from './runtime'
import { viewIdOf } from './tab-manager'

/** `globalThis.__pragmaBrowserTest`, installed only when `PRAGMA_TEST=1` (§8). */
export interface BrowserTestHooks {
  snapshot(): BrowserSnapshot
  /** Runs `code` in the page's main world, as a user gesture (history entries stay back-navigable). */
  evalMain(tabId: string, code: string): Promise<unknown>
  /** Runs `code` in the picker's isolated world. */
  evalPicker(tabId: string, code: string): Promise<unknown>
  /** Trusted input events (`webContents.sendInputEvent`), in order. */
  sendInput(tabId: string, events: (MouseInputEvent | KeyboardInputEvent)[]): Promise<void>
  isViewVisible(tabId: string): boolean
  isDevToolsOpened(tabId: string): boolean
  /** The partition whose session the tab's page really uses (null on a mismatch). */
  partitionOf(tabId: string): string | null
  /** URLs handed to the OS (recorded instead of opened). */
  externalOpens: string[]
  /** SDK freeze/unfreeze, so window screenshots (which miss native views) show the page as an image. */
  freeze(tabId: string): Promise<void>
  unfreeze(tabId: string): Promise<void>
}
export type BrowserTestGlobal = { __pragmaBrowserTest: BrowserTestHooks }

export class NoLiveTabError extends Error {}

export function createBrowserTestHooks(): BrowserTestHooks {
  const rt = getMainRuntime()
  const externalOpens: string[] = []
  rt.host.openExternal = async (url) => {
    externalOpens.push(url)
  }
  const wc = (tabId: string): WebContents => {
    const guest = rt.manager.getGuest(tabId)
    if (!guest) throw new NoLiveTabError(`no live tab ${tabId}`)
    return guest as unknown as WebContents
  }
  return {
    externalOpens,
    snapshot: () => rt.manager.snapshot(),
    evalMain: (tabId, code) => wc(tabId).executeJavaScript(code, true),
    evalPicker: (tabId, code) => wc(tabId).executeJavaScriptInIsolatedWorld(PICKER_WORLD_ID, [{ code }]),
    async sendInput(tabId, events) {
      const target = wc(tabId)
      for (const event of events) target.sendInputEvent(event)
      await target.executeJavaScript('new Promise((r) => requestAnimationFrame(() => r(true)))')
    },
    isViewVisible: (tabId) => (rt.manager.getView(tabId) as unknown as WebContentsView | null)?.getVisible() ?? false,
    isDevToolsOpened: (tabId) => wc(tabId).isDevToolsOpened(),
    freeze: (tabId) => rt.host.freeze(viewIdOf(tabId)),
    unfreeze: (tabId) => rt.host.unfreeze(viewIdOf(tabId)),
    partitionOf(tabId) {
      const partition = partitionForWorktree(rt.manager.worktreeOf(tabId))
      return wc(tabId).session === session.fromPartition(partition) ? partition : null
    },
  }
}

export default defineTestHooks(() => {
  ;(globalThis as unknown as BrowserTestGlobal).__pragmaBrowserTest = createBrowserTestHooks()
})
