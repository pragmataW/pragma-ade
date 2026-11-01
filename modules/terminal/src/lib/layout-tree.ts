import { LAYOUT_NODE, type LayoutNode, type PaneNode, type SplitAction, type SplitNode } from '../contract'

/** Pure operations on a tab's split tree, shared by the main layout store and the renderer. */

export const paneLeaf = (paneId: string): PaneNode => ({ kind: LAYOUT_NODE.pane, paneId })

/** Pane ids in reading order (left to right, top to bottom). */
export function leafIds(node: LayoutNode): string[] {
  return node.kind === LAYOUT_NODE.pane ? [node.paneId] : node.children.flatMap(leafIds)
}

/** A child of the same direction is inlined, so a row inside a row never appears. */
function makeSplit(direction: SplitAction, children: LayoutNode[]): SplitNode {
  const flat = children.flatMap((c) => (c.kind === LAYOUT_NODE.split && c.direction === direction ? c.children : [c]))
  return { kind: LAYOUT_NODE.split, direction, children: flat }
}

/**
 * Puts `newPaneId` next to `targetPaneId` (after it, in `direction`). Splitting along the target's own row or column
 * adds a sibling there; otherwise the target becomes a new split of two. Unknown targets leave the tree unchanged.
 */
export function splitPane(
  root: LayoutNode,
  targetPaneId: string,
  newPaneId: string,
  direction: SplitAction,
): LayoutNode {
  if (root.kind === LAYOUT_NODE.pane) {
    return root.paneId === targetPaneId ? makeSplit(direction, [root, paneLeaf(newPaneId)]) : root
  }
  const index = root.children.findIndex((c) => c.kind === LAYOUT_NODE.pane && c.paneId === targetPaneId)
  if (index >= 0 && root.direction === direction) {
    const children = [...root.children]
    children.splice(index + 1, 0, paneLeaf(newPaneId))
    return { ...root, children }
  }
  const children = root.children.map((c) => splitPane(c, targetPaneId, newPaneId, direction))
  return children.every((c, i) => c === root.children[i]) ? root : { ...root, children }
}

/** Removes a pane; a split left with one child collapses into it. Null when the last pane goes. */
export function removePane(root: LayoutNode, paneId: string): LayoutNode | null {
  if (root.kind === LAYOUT_NODE.pane) return root.paneId === paneId ? null : root
  const children = root.children.flatMap((c) => removePane(c, paneId) ?? [])
  const [only] = children
  if (!only) return null
  if (children.length === 1) return only
  return children.length === root.children.length && children.every((c, i) => c === root.children[i])
    ? root
    : makeSplit(root.direction, children)
}

/** The pane to focus once `paneId` closes: the next one in reading order, else the previous one. */
export function neighbourPane(root: LayoutNode, paneId: string): string | null {
  const ids = leafIds(root)
  const index = ids.indexOf(paneId)
  if (index < 0) return null
  return ids[index + 1] ?? ids[index - 1] ?? null
}
