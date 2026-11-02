import { useCallback, useState } from 'react'

const FILL = 'h-full min-h-0'

/**
 * A DOM node that outlives layout changes: content is rendered into it with `createPortal` from a stable place, and
 * `<Mount>` moves the node into whichever pane hosts it now, so moving a pane never remounts what it shows.
 */
export function usePortalNode(): HTMLDivElement {
  const [node] = useState(() => {
    const el = document.createElement('div')
    el.className = FILL
    return el
  })
  return node
}

/** `name`: the pane's `view-transition-name`, so layout changes animate it (see `animateLayout`). */
export function Mount({ node, name }: { node: HTMLElement; name?: string }) {
  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && node.parentElement !== el) el.appendChild(node)
    },
    [node],
  )
  return <div ref={attach} className={FILL} style={name ? { viewTransitionName: name } : undefined} />
}
