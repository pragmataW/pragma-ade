import { useT } from '@pragma/sdk/renderer'
import { type KeyboardEvent, type MouseEvent, type RefObject, useEffect } from 'react'
import { FILE_REF_ATTR, KEY_ENTER, LINK_ROLE } from '../../../../constants'
import type { FileLinks } from './use-file-links'

const INLINE_CODE = 'code'
const BLOCK_CODE = 'pre, .pragma-code'
const LINK_CLASSES = ['cursor-pointer', 'underline-offset-2', 'hover:underline', 'hover:text-ac']
const ROLE = 'role'
const TAB_INDEX = 'tabindex'
const TITLE = 'title'

/** Marks (or unmarks) one inline code element as a file link. */
function decorate(el: Element, title: string | null): void {
  if (title === null) {
    for (const a of [FILE_REF_ATTR, ROLE, TAB_INDEX, TITLE]) el.removeAttribute(a)
    el.classList.remove(...LINK_CLASSES)
    return
  }
  el.setAttribute(FILE_REF_ATTR, '')
  el.setAttribute(ROLE, LINK_ROLE)
  el.setAttribute(TAB_INDEX, '0')
  el.setAttribute(TITLE, title)
  el.classList.add(...LINK_CLASSES)
}

/**
 * 11c: inline code spans of rendered Markdown that are in-worktree file references become links (the Markdown
 * component is 00's and takes no renderers, so the rendered DOM is decorated); clicks are delegated to the root.
 */
export function useInlineFileRefs(root: RefObject<HTMLElement | null>, text: string, links: FileLinks) {
  const t = useT()
  // after EVERY render: `<Markdown>` builds new renderer components per render, so React remounts its `<code>` nodes
  useEffect(() => {
    void text
    for (const el of root.current?.querySelectorAll(INLINE_CODE) ?? []) {
      if (el.closest(BLOCK_CODE)) continue
      const ref = links.refOf(el.textContent ?? '')
      decorate(el, ref ? t('chat:fileLink.open', { path: ref.path }) : null)
    }
  })
  const activate = (e: MouseEvent | KeyboardEvent) => {
    const el = (e.target as Element).closest(`[${FILE_REF_ATTR}]`)
    const ref = el ? links.refOf(el.textContent ?? '') : null
    if (!ref) return
    e.preventDefault()
    links.open(ref)
  }
  return {
    onClick: activate,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === KEY_ENTER) activate(e)
    },
  }
}
