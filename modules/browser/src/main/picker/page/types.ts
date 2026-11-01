/// <reference lib="dom" />
/** Types shared by the in-page picker functions (type-only: nothing here reaches the page). */

export interface SelectorOpts {
  maxDepth: number
  domPathMaxDepth: number
  /** Stable classes per selector part. */
  maxClasses: number
  /** RegExp sources; they cross the injection boundary as strings. */
  hashyClassPatterns: string[]
}

export interface CollectOpts extends SelectorOpts {
  outerHtmlMax: number
  textMax: number
  styleProps: string[]
  redacted: string
  /** RegExp source matched against attribute names whose values are redacted. */
  sensitiveAttrPattern: string
  /** `{n}` is replaced with the number of cut characters. */
  truncationTemplate: string
}

export interface PageRect {
  x: number
  y: number
  width: number
  height: number
}

/** What the page reports for a picked element (untrusted: main validates and clamps it again). */
export interface RawPickedElement {
  url: string
  title: string
  selector: string
  domPath: string
  tagName: string
  outerHtml: string
  text: string
  rect: PageRect
  viewport: { width: number; height: number }
  styles: Record<string, string>
}

export interface SelectorKit {
  escape(value: string): string
  stableClasses(el: Element, max: number): string[]
  isStableId(id: string): boolean
  /** `tag#id` for a stable id, else the tag plus up to two stable classes. */
  part(el: Element): string
  /** `sel` matches exactly `el` in its document. */
  unique(el: Element, sel: string): boolean
  nthOfType(node: Element): string
  /** Another sibling also matches `sel`. */
  ambiguous(node: Element, sel: string): boolean
  /** `a > b > c`. */
  join(parts: string[]): string
}

export type PickOutcome = { kind: 'picked'; element: RawPickedElement; nonce: string } | { kind: 'cancelled' }

export interface PickerDebugState {
  armed: boolean
  hoverSelector: string | null
  boxVisible: boolean
  marks: number
}

export interface InstalledPicker {
  /** Shows the overlay; new options (nonce, accent) replace the current ones. */
  arm(next?: OverlayOpts): void
  awaitPick(): Promise<PickOutcome>
  cancel(): void
  hideOverlay(): void
  showOverlay(): void
  teardown(): void
  debugState(): PickerDebugState
}

export interface OverlayOpts extends CollectOpts {
  nonce: string
  accent: string
  /** Hint shown in the page while armed (translated in main). */
  hint: string
  /** Attribute set to `nonce` on the picked element (the main-world probe finds it there). */
  pickAttr: string
}

/** `globalThis.__pragmaPickerLib` (isolated world): the self-contained functions, installed once per page. */
export interface PickerLib {
  selectorKit(opts: SelectorOpts): SelectorKit
  buildSelector(el: Element, opts: SelectorOpts): string
  buildDomPath(el: Element, opts: SelectorOpts): string
  collectElementContext(el: Element, opts: CollectOpts): RawPickedElement
  installPicker(opts: OverlayOpts): InstalledPicker
}

export type PickerGlobal = { __pragmaPickerLib?: PickerLib; __pragmaPicker?: InstalledPicker }
