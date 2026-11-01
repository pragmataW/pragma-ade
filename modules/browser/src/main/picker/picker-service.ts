import { randomUUID } from 'node:crypto'
import {
  DOM_PATH_MAX_DEPTH,
  HASHY_CLASS_RES,
  PICK_ATTR,
  PICK_TIMEOUT_MS,
  PICKER_WORLD_ID,
  REACT_PROBE_TIMEOUT_MS,
  REDACTED,
  SELECTOR_MAX_CLASSES,
  SELECTOR_MAX_DEPTH,
  SENSITIVE_ATTR_RE,
  TRUNCATION_TEMPLATE,
} from '../../constants'
import {
  BROWSER_ERROR_CODE,
  BrowserError,
  type BrowserPick,
  type BrowserSettings,
  CANCEL_REASON,
  type CancelReason,
} from '../../contract'
import { formatConsoleEntry } from '../console-buffer'
import type { BrowserHost, GuestLike } from '../guest'
import type { PickerControl } from '../picker-control'
import { type BrowserTabManager, viewIdOf } from '../tab-manager'
import { captureElement, saveShot } from './capture'
import type { PickOutcome, RawPickedElement } from './page/types'
import { parseRawPick, sanitizeUrl } from './payload'
import { parseReactProbe, reactProbeScript } from './react-probe'
import { buildPickerScript, PICKER_ACTION, type PickerAction, type PickerScriptOpts } from './script'

export interface PickerEmit {
  picked(p: BrowserPick): void
  cancelled(e: { tabId: string; reason: CancelReason }): void
  armedChanged(tabId: string | null): void
}

export interface PickerDeps {
  manager: Pick<BrowserTabManager, 'getGuest' | 'consoleErrors' | 'onTabClosed' | 'worktreeOf'>
  views: Pick<BrowserHost, 'freeze' | 'unfreeze'>
  settings: () => BrowserSettings
  shotsDir: string
  /** Theme accent and the translated in-page hint. */
  page: () => { accent: string; hint: string }
  emit: PickerEmit
}

interface Session {
  tabId: string
  nonce: string
  guest: GuestLike
  ended: boolean
  /** Resolves when the session is cancelled from outside the page (navigation, destroy, timeout, user). */
  stop: Promise<PickOutcome>
  /** Stops listening and disarms; false when the session had already ended. */
  close(): boolean
  /** `close` plus the cancel event. */
  end(reason: CancelReason): void
}

const NAVIGATION_EVENT = 'did-start-navigation'
const DESTROYED_EVENT = 'destroyed'
const STOPPED: PickOutcome = { kind: 'cancelled' }
const PICKED = 'picked'

const withTimeout = <T>(work: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms)
  })
  return Promise.race([work.catch(() => fallback), timeout]).finally(() => clearTimeout(timer))
}

/**
 * Arms the isolated-world picker on a tab, turns one pick into a `BrowserPick` (validated payload, React probe,
 * element screenshot, console errors), freezes the view under the comment popover and unfreezes it on dismiss.
 */
export class PickerService implements PickerControl {
  readonly #deps: PickerDeps
  readonly #picks = new Map<string, BrowserPick>()
  #session: Session | null = null

  constructor(deps: PickerDeps) {
    this.#deps = deps
    deps.manager.onTabClosed((tabId) => this.#onTabClosed(tabId))
  }

  get(pickId: string): BrowserPick | undefined {
    return this.#picks.get(pickId)
  }

  async start(tabId: string): Promise<void> {
    if (this.#session?.tabId === tabId) return
    if (this.#session) this.cancel(this.#session.tabId)
    const guest = this.#deps.manager.getGuest(tabId)
    if (!guest) throw new BrowserError(BROWSER_ERROR_CODE.tabNotFound, tabId)
    const session = this.#open(tabId, guest)
    try {
      await this.#run(session, PICKER_ACTION.arm)
      const outcome = await Promise.race([
        this.#run(session, PICKER_ACTION.awaitPick) as Promise<PickOutcome>,
        session.stop,
      ])
      if (session.ended) return
      if (outcome?.kind !== PICKED) return session.end(CANCEL_REASON.user)
      await this.#complete(session, outcome.element)
    } catch {
      session.end(CANCEL_REASON.error)
    }
  }

  cancel(tabId: string, reason: CancelReason = CANCEL_REASON.user): void {
    const session = this.#session
    if (session?.tabId !== tabId) return
    this.#run(session, PICKER_ACTION.cancel).catch(() => undefined)
    session.end(reason)
  }

  dismiss(pickId: string): void {
    const pick = this.#picks.get(pickId)
    if (!pick) return
    this.#picks.delete(pickId)
    this.#deps.views.unfreeze(viewIdOf(pick.tabId)).catch(() => undefined)
  }

  // ── internals ───────────────────────────────────────────────────────────────────────────────────────────────

  #scriptOpts(nonce: string): PickerScriptOpts {
    const s = this.#deps.settings()
    return {
      maxDepth: SELECTOR_MAX_DEPTH,
      domPathMaxDepth: DOM_PATH_MAX_DEPTH,
      maxClasses: SELECTOR_MAX_CLASSES,
      hashyClassPatterns: [...HASHY_CLASS_RES],
      outerHtmlMax: s.outerHtmlMaxChars,
      textMax: s.textMaxChars,
      styleProps: s.styleProps,
      redacted: REDACTED,
      sensitiveAttrPattern: SENSITIVE_ATTR_RE,
      truncationTemplate: TRUNCATION_TEMPLATE,
      pickAttr: PICK_ATTR,
      nonce,
      ...this.#deps.page(),
    }
  }

  #run(session: Session, action: PickerAction): Promise<unknown> {
    const code = buildPickerScript(action, this.#scriptOpts(session.nonce))
    return session.guest.executeJavaScriptInIsolatedWorld(PICKER_WORLD_ID, [{ code }])
  }

  #open(tabId: string, guest: GuestLike): Session {
    let resolveStop: (o: PickOutcome) => void = () => undefined
    const onNavigate = (...args: unknown[]) => {
      const e = args[0] as { isMainFrame?: boolean; isSameDocument?: boolean } | undefined
      if (e?.isMainFrame && !e.isSameDocument) session.end(CANCEL_REASON.navigation)
    }
    const onDestroyed = () => session.end(CANCEL_REASON.destroyed)
    const timer = setTimeout(() => this.cancel(tabId, CANCEL_REASON.timeout), PICK_TIMEOUT_MS)
    const session: Session = {
      tabId,
      nonce: randomUUID(),
      guest,
      ended: false,
      stop: new Promise((resolve) => {
        resolveStop = resolve
      }),
      close: () => {
        if (session.ended) return false
        session.ended = true
        clearTimeout(timer)
        guest.off(NAVIGATION_EVENT, onNavigate)
        guest.off(DESTROYED_EVENT, onDestroyed)
        resolveStop(STOPPED)
        if (this.#session === session) this.#session = null
        this.#deps.emit.armedChanged(null)
        return true
      },
      end: (reason) => {
        if (session.close()) this.#deps.emit.cancelled({ tabId, reason })
      },
    }
    guest.on(NAVIGATION_EVENT, onNavigate)
    guest.on(DESTROYED_EVENT, onDestroyed)
    this.#session = session
    this.#deps.emit.armedChanged(tabId)
    return session
  }

  async #complete(session: Session, rawElement: RawPickedElement): Promise<void> {
    const s = this.#deps.settings()
    const element = parseRawPick(rawElement, s)
    if (!element) return session.end(CANCEL_REASON.error)
    const { guest, tabId } = session
    const pickId = randomUUID()
    const component = s.reactProbe
      ? parseReactProbe(
          await withTimeout(guest.executeJavaScript(reactProbeScript(session.nonce)), REACT_PROBE_TIMEOUT_MS, null),
        )
      : null
    const png = await captureElement(guest, element.rect, element.viewport, (a) => this.#run(session, a)).catch(
      () => null,
    )
    const screenshotPath = png ? await saveShot(this.#deps.shotsDir, pickId, png).catch(() => null) : null
    if (session.ended) return
    const consoleErrors = this.#deps.manager.consoleErrors(tabId, s.consoleErrorsInComment).map(formatConsoleEntry)
    await this.#deps.views.freeze(viewIdOf(tabId)).catch(() => undefined)
    if (session.ended) return
    const pick: BrowserPick = {
      ...element,
      pickId,
      tabId,
      worktreeId: this.#deps.manager.worktreeOf(tabId),
      url: sanitizeUrl(element.url),
      component,
      screenshotPath,
      consoleErrors,
    }
    session.close()
    this.#picks.set(pickId, pick)
    this.#deps.emit.picked(pick)
  }

  #onTabClosed(tabId: string): void {
    if (this.#session?.tabId === tabId) this.#session.end(CANCEL_REASON.destroyed)
    for (const [id, pick] of this.#picks) if (pick.tabId === tabId) this.#picks.delete(id)
  }
}
