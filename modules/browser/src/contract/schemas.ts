import { RectSchema, z } from '@pragma/sdk'
import { SETTINGS_LIMITS as L } from '../constants'

export { type Rect, RectSchema } from '@pragma/sdk'

export const CANCEL_REASON = {
  user: 'user',
  navigation: 'navigation',
  destroyed: 'destroyed',
  timeout: 'timeout',
  error: 'error',
} as const
export const CANCEL_REASONS = Object.values(CANCEL_REASON) as readonly CancelReason[]
export type CancelReason = (typeof CANCEL_REASON)[keyof typeof CANCEL_REASON]
export const HISTORY_ACTION = { back: 'back', forward: 'forward', reload: 'reload', stop: 'stop' } as const
export const HISTORY_ACTIONS = Object.values(HISTORY_ACTION) as readonly HistoryAction[]
export type HistoryAction = (typeof HISTORY_ACTION)[keyof typeof HISTORY_ACTION]
export const ZOOM_ACTION = { in: 'in', out: 'out', reset: 'reset' } as const
export const ZOOM_ACTIONS = Object.values(ZOOM_ACTION) as readonly ZoomAction[]
export type ZoomAction = (typeof ZOOM_ACTION)[keyof typeof ZOOM_ACTION]

const id = z.string().min(1)

export const LoadErrorSchema = z.object({ code: z.number(), description: z.string() })
export type LoadError = z.infer<typeof LoadErrorSchema>

export const BrowserTabStateSchema = z.object({
  id,
  worktreeId: id,
  url: z.string(),
  title: z.string(),
  faviconUrl: z.string().nullable(),
  isLoading: z.boolean(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
  zoomFactor: z.number(),
  devToolsOpen: z.boolean(),
  discarded: z.boolean(),
  loadError: LoadErrorSchema.nullable(),
})
export type BrowserTabState = z.infer<typeof BrowserTabStateSchema>

export const WorktreeTabsSchema = z.object({ tabIds: z.array(id), activeTabId: id.nullable() })
export type WorktreeTabs = z.infer<typeof WorktreeTabsSchema>

export const BrowserSnapshotSchema = z.object({
  activeWorktreeId: id.nullable(),
  worktrees: z.record(z.string(), WorktreeTabsSchema),
  tabs: z.record(z.string(), BrowserTabStateSchema),
  pickerArmedTabId: id.nullable(),
})
export type BrowserSnapshot = z.infer<typeof BrowserSnapshotSchema>

export const ViewportSchema = z.object({ width: z.number(), height: z.number() })
export type Viewport = z.infer<typeof ViewportSchema>

export const PickedComponentSchema = z.object({ name: z.string(), source: z.string().optional() })
export type PickedComponent = z.infer<typeof PickedComponentSchema>

export const BrowserPickSchema = z.object({
  pickId: id,
  tabId: id,
  worktreeId: id,
  /** Sanitized: no userinfo or fragment, sensitive query values redacted. */
  url: z.string(),
  title: z.string(),
  selector: z.string(),
  domPath: z.string(),
  tagName: z.string(),
  outerHtml: z.string(),
  text: z.string(),
  rect: RectSchema,
  viewport: ViewportSchema,
  styles: z.record(z.string(), z.string()),
  component: PickedComponentSchema.nullable(),
  screenshotPath: z.string().nullable(),
  consoleErrors: z.array(z.string()),
})
export type BrowserPick = z.infer<typeof BrowserPickSchema>

const count = (max: number) => z.number().int().min(1).max(max)

export const BrowserSettingsSchema = z.object({
  /** `{query}` is replaced with the URI-encoded search text. */
  searchUrl: z.string().min(1),
  consoleBufferSize: count(L.consoleBufferMax),
  consoleErrorsInComment: z.number().int().min(0).max(L.consoleErrorsMax),
  outerHtmlMaxChars: count(L.outerHtmlMax),
  textMaxChars: count(L.textMax),
  styleProps: z.array(z.string().min(1)),
  maxLiveViews: count(L.liveViewsMax),
  screenshotRetentionDays: count(L.retentionDaysMax),
  reactProbe: z.boolean(),
})
export type BrowserSettings = z.infer<typeof BrowserSettingsSchema>

export const BROWSER_ERROR_CODE = {
  tabNotFound: 'tabNotFound',
  invalidInput: 'invalidInput',
  noWorktree: 'noWorktree',
  pickNotFound: 'pickNotFound',
} as const
export type BrowserErrorCode = (typeof BROWSER_ERROR_CODE)[keyof typeof BROWSER_ERROR_CODE]
export const BROWSER_ERROR_CODES = Object.values(BROWSER_ERROR_CODE) as readonly BrowserErrorCode[]

/** Every throw of the module; the IPC message starts with the code (`tabNotFound: …`). */
export class BrowserError extends Error {
  readonly code: BrowserErrorCode
  constructor(code: BrowserErrorCode, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'BrowserError'
    this.code = code
  }
}
