import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { BrowserPickSchema, BrowserSnapshotSchema, CANCEL_REASON, HISTORY_ACTION, ZOOM_ACTION } from './schemas'

/** Renderer → main channels. */
export const BROWSER_IPC = {
  getSnapshot: 'browser.getSnapshot',
  openTab: 'browser.openTab',
  closeTab: 'browser.closeTab',
  activateTab: 'browser.activateTab',
  navigate: 'browser.navigate',
  history: 'browser.history',
  toggleDevTools: 'browser.toggleDevTools',
  zoom: 'browser.zoom',
  pickerStart: 'browser.picker.start',
  pickerCancel: 'browser.picker.cancel',
  pickDismiss: 'browser.pick.dismiss',
} as const
/** Main → renderer events. */
export const BROWSER_IPC_EVENTS = {
  snapshot: 'browser.snapshot',
  picked: 'browser.picked',
  pickCancelled: 'browser.pickCancelled',
  focusAddressBar: 'browser.focusAddressBar',
} as const

const id = z.string().min(1)
const tabRef = z.object({ tabId: id })
const none = z.object({})

export const BrowserIpc = {
  getSnapshot: defineIpc({ channel: BROWSER_IPC.getSnapshot, input: none, output: BrowserSnapshotSchema }),
  openTab: defineIpc({
    channel: BROWSER_IPC.openTab,
    input: z.object({ worktreeId: id.optional(), url: z.string().optional() }),
    output: tabRef,
  }),
  closeTab: defineIpc({ channel: BROWSER_IPC.closeTab, input: tabRef, output: none }),
  activateTab: defineIpc({ channel: BROWSER_IPC.activateTab, input: tabRef, output: none }),
  navigate: defineIpc({
    channel: BROWSER_IPC.navigate,
    input: tabRef.extend({ input: z.string() }),
    output: z.object({ url: z.string() }),
  }),
  history: defineIpc({
    channel: BROWSER_IPC.history,
    input: tabRef.extend({ action: z.enum(HISTORY_ACTION) }),
    output: none,
  }),
  toggleDevTools: defineIpc({
    channel: BROWSER_IPC.toggleDevTools,
    input: tabRef,
    output: z.object({ open: z.boolean() }),
  }),
  zoom: defineIpc({
    channel: BROWSER_IPC.zoom,
    input: tabRef.extend({ action: z.enum(ZOOM_ACTION) }),
    output: z.object({ zoomFactor: z.number() }),
  }),
  pickerStart: defineIpc({ channel: BROWSER_IPC.pickerStart, input: tabRef, output: none }),
  pickerCancel: defineIpc({ channel: BROWSER_IPC.pickerCancel, input: tabRef, output: none }),
  pickDismiss: defineIpc({ channel: BROWSER_IPC.pickDismiss, input: z.object({ pickId: id }), output: none }),
  snapshot: defineIpcEvent({ channel: BROWSER_IPC_EVENTS.snapshot, payload: BrowserSnapshotSchema }),
  picked: defineIpcEvent({ channel: BROWSER_IPC_EVENTS.picked, payload: BrowserPickSchema }),
  pickCancelled: defineIpcEvent({
    channel: BROWSER_IPC_EVENTS.pickCancelled,
    payload: tabRef.extend({ reason: z.enum(CANCEL_REASON) }),
  }),
  focusAddressBar: defineIpcEvent({ channel: BROWSER_IPC_EVENTS.focusAddressBar, payload: tabRef }),
} as const
