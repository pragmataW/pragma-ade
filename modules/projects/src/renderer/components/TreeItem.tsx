import type { ComponentProps } from 'react'

/** A WAI-ARIA `treeitem` of the sidebar worktree tree (folders and worktree rows); focusable by script by default. */
export function TreeItem({ level, ...props }: ComponentProps<'div'> & { level: number }) {
  return <div role="treeitem" aria-level={level} tabIndex={-1} {...props} />
}
