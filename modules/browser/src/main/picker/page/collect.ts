/// <reference lib="dom" />
// Adapted from stablyai/orca src/main/browser/grab-guest-element-context-script.ts (MIT) — see THIRD_PARTY_NOTICES.md
//
// Self-contained (see selector.ts): injected with `Function.prototype.toString`.
import type { CollectOpts, PickerGlobal, PickerLib, RawPickedElement } from './types'

/** URL, selector, DOM path, clamped + redacted outerHTML, text, rect, viewport and the requested computed styles. */
export function collectElementContext(el: Element, opts: CollectOpts): RawPickedElement {
  const lib = (globalThis as PickerGlobal).__pragmaPickerLib as PickerLib
  const view = el.ownerDocument.defaultView as Window
  const clamp = (value: string, max: number): string =>
    value.length <= max
      ? value
      : value.slice(0, max) + opts.truncationTemplate.replace('{n}', String(value.length - max))
  const sensitive = new RegExp(opts.sensitiveAttrPattern, 'i')
  const VALUE = 'value'
  const redact = (node: Element): void => {
    const secretInput = node.tagName === 'INPUT' && /^(password|hidden)$/i.test(node.getAttribute('type') ?? '')
    if (secretInput && node.hasAttribute(VALUE)) node.setAttribute(VALUE, opts.redacted)
    for (const attr of Array.from(node.attributes))
      if (sensitive.test(attr.name)) node.setAttribute(attr.name, opts.redacted)
  }
  const clone = el.cloneNode(true) as Element
  for (const node of [clone, ...Array.from(clone.querySelectorAll('*'))]) redact(node)
  const box = el.getBoundingClientRect()
  const computed = view.getComputedStyle(el)
  const styles: Record<string, string> = {}
  for (const prop of opts.styleProps) styles[prop] = computed.getPropertyValue(prop)
  const rawText = el.textContent ?? ''
  return {
    url: view.location.href,
    title: el.ownerDocument.title,
    selector: lib.buildSelector(el, opts),
    domPath: lib.buildDomPath(el, opts),
    tagName: el.tagName.toLowerCase(),
    outerHtml: clamp(clone.outerHTML, opts.outerHtmlMax),
    text: clamp(rawText.replace(/\s+/g, ' ').trim(), opts.textMax),
    rect: { x: box.x, y: box.y, width: box.width, height: box.height },
    viewport: { width: view.innerWidth, height: view.innerHeight },
    styles,
  }
}
