/// <reference lib="dom" />
// Adapted from stablyai/orca src/main/browser/grab-guest-react-script.ts (MIT) — see THIRD_PARTY_NOTICES.md
//
// Self-contained functions that run in the page's MAIN world (React's fiber expandos are invisible to isolated
// worlds). Read-only apart from removing the pick attribute; the result is untrusted and validated in main.

export interface ReactProbeOpts {
  nonce: string
  attr: string
  maxDepth: number
  /** RegExp sources of component names that are framework plumbing. */
  skipPatterns: string[]
}

export interface FiberLike {
  type?: unknown
  elementType?: unknown
  return?: FiberLike | null
  _debugSource?: { fileName?: string; lineNumber?: number; columnNumber?: number } | null
  _debugOwner?: FiberLike | null
  _debugStack?: unknown
}

export interface FiberHelpers {
  name(f: FiberLike): string | null
  source(f: FiberLike): string | null
}

/** The component name of a fiber (null for host elements). */
export function fiberName(f: FiberLike): string | null {
  const t = (f.type ?? f.elementType) as { displayName?: string; name?: string; render?: { name?: string } } | string
  if (!t || typeof t === 'string') return null
  return t.displayName || t.name || t.render?.name || null
}

/** `file:line[:col]` from `_debugSource` (≤ React 18), the owner's, or the first app frame of `_debugStack` (React 19). */
export function fiberSource(f: FiberLike): string | null {
  const fromSource = (s: FiberLike['_debugSource']): string | null =>
    s?.fileName && s.lineNumber ? `${s.fileName}:${s.lineNumber}${s.columnNumber ? `:${s.columnNumber}` : ''}` : null
  const stack = f._debugStack
  const text = typeof stack === 'string' ? stack : ((stack as { stack?: string } | null)?.stack ?? '')
  const frame = [...text.matchAll(/(?<url>https?:\/\/[^\s()]+):(?<line>\d+):(?<col>\d+)/g)]
    .map((m) => m.groups ?? {})
    .find((g) => g.url && !g.url.includes('node_modules') && !g.url.includes('/@'))
  const fromStack = frame
    ? `${(frame.url ?? '').replace(/^https?:\/\/[^/]+\//, '').replace(/[?#].*$/, '')}:${frame.line}:${frame.col}`
    : null
  return fromSource(f._debugSource) ?? fromSource(f._debugOwner?._debugSource) ?? fromStack
}

/** The innermost non-skipped component of the element tagged with `nonce`, with the nearest source location. */
export function reactProbe(opts: ReactProbeOpts, h: FiberHelpers): { name: string; source?: string } | null {
  const el = document.querySelector(`[${opts.attr}="${opts.nonce}"]`)
  if (!el) return null
  el.removeAttribute(opts.attr)
  const skip = opts.skipPatterns.map((p) => new RegExp(p))
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'))
  let fiber = key ? ((el as unknown as Record<string, FiberLike | undefined>)[key] ?? null) : null
  let source: string | null = null
  for (let depth = 0; fiber && depth < opts.maxDepth; depth++, fiber = fiber.return ?? null) {
    source ??= h.source(fiber)
    const name = h.name(fiber)
    if (name && !skip.some((re) => re.test(name))) return source ? { name, source } : { name }
  }
  return null
}
