/// <reference lib="dom" />
// Adapted from stablyai/orca src/main/browser/grab-guest-element-context-script.ts (MIT) — see THIRD_PARTY_NOTICES.md
//
// Every exported function is self-contained (no imports, no module-scope references): `script.ts` injects them with
// `Function.prototype.toString`. They reach each other through `globalThis.__pragmaPickerLib`.
import type { PickerGlobal, PickerLib, SelectorKit, SelectorOpts } from './types'

/** Escaping, stable-name and uniqueness helpers shared by the selector and the DOM path. */
export function selectorKit(opts: SelectorOpts): SelectorKit {
  const hashy = opts.hashyClassPatterns.map((p) => new RegExp(p))
  const isHashy = (value: string) => hashy.some((re) => re.test(value))
  const escapeCss = (value: string): string => {
    const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS
    if (css?.escape) return css.escape(value)
    return value.replace(/^(\d)|[^a-zA-Z0-9_-]/g, (ch, digit?: string) => (digit ? `\\3${digit} ` : `\\${ch}`))
  }
  const stableClasses = (el: Element, max: number): string[] =>
    Array.from(el.classList)
      .filter((c) => c && !isHashy(c))
      .slice(0, max)
  const isStableId = (id: string) => id.length > 0 && !isHashy(id)
  const part = (el: Element): string => {
    const tag = el.tagName.toLowerCase()
    if (isStableId(el.id)) return `${tag}#${escapeCss(el.id)}`
    return (
      tag +
      stableClasses(el, opts.maxClasses)
        .map((c) => `.${escapeCss(c)}`)
        .join('')
    )
  }
  const unique = (el: Element, sel: string): boolean => {
    try {
      const hits = el.ownerDocument.querySelectorAll(sel)
      return hits.length === 1 && hits[0] === el
    } catch {
      return false
    }
  }
  const siblings = (node: Element): Element[] => Array.from(node.parentElement?.children ?? [])
  const nthOfType = (node: Element): string =>
    `:nth-of-type(${
      siblings(node)
        .filter((c) => c.tagName === node.tagName)
        .indexOf(node) + 1
    })`
  const ambiguous = (node: Element, sel: string): boolean => siblings(node).some((s) => s !== node && s.matches(sel))
  const join = (parts: string[]): string => parts.join(' > ')
  return { escape: escapeCss, stableClasses, isStableId, part, unique, nthOfType, ambiguous, join }
}

/** A unique selector: a stable id, else a short `>` chain (nth-of-type only where needed), else a full nth chain. */
export function buildSelector(el: Element, opts: SelectorOpts): string {
  const kit = ((globalThis as PickerGlobal).__pragmaPickerLib as PickerLib).selectorKit(opts)
  const doc = el.ownerDocument
  const shortChain = (): string | null => {
    const parts: string[] = []
    for (
      let node: Element | null = el;
      node && node !== doc.body && parts.length < opts.maxDepth;
      node = node.parentElement
    ) {
      const base = kit.part(node)
      const positional = kit.ambiguous(node, base)
      parts.unshift(positional ? base + kit.nthOfType(node) : base)
      // A positional top part is anchored by one more ancestor before the chain is accepted.
      if (!positional && kit.unique(el, kit.join(parts))) return kit.join(parts)
    }
    return null
  }
  const fullChain = (): string => {
    const full: string[] = []
    for (let node: Element | null = el; node && node !== doc.documentElement; node = node.parentElement)
      full.unshift(node.tagName.toLowerCase() + kit.nthOfType(node))
    return kit.join([doc.documentElement.tagName.toLowerCase(), ...full])
  }
  if (el === doc.documentElement || el === doc.body) return el.tagName.toLowerCase()
  const byId = `#${kit.escape(el.id)}`
  if (kit.isStableId(el.id) && kit.unique(el, byId)) return byId
  return shortChain() ?? fullChain()
}

/** A readable path such as `body > main > ul.list > li.item` (no positions; at most `domPathMaxDepth` parts). */
export function buildDomPath(el: Element, opts: SelectorOpts): string {
  const kit = ((globalThis as PickerGlobal).__pragmaPickerLib as PickerLib).selectorKit(opts)
  const parts: string[] = []
  for (let node: Element | null = el; node && parts.length < opts.domPathMaxDepth; node = node.parentElement) {
    parts.unshift(kit.part(node))
    if (node === el.ownerDocument.body) break
  }
  return kit.join(parts)
}
