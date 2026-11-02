import type { ChangeMode } from './schemas'

/** `data-testid`s other modules' E2E tests may use (§10.1.6). */
export const GitChangesTestIds = {
  panel: 'gc-panel',
  mode: (m: ChangeMode) => `gc-mode-${m}`,
  basePicker: 'gc-base-picker',
  baseError: 'gc-base-error',
  totals: 'gc-totals',
  toggleView: 'gc-toggle-view',
  toggleStyle: 'gc-toggle-style',
  toggleFull: 'gc-toggle-full',
  tree: 'gc-tree',
  treeRow: 'gc-tree-row',
  /** Right-click menu of a file row. */
  rowMenu: 'gc-row-menu',
  rowMenuOpenInEditor: 'gc-row-menu-open-in-editor',
  empty: 'gc-empty',
  diff: 'gc-diff',
  diffHeader: 'gc-diff-header',
  placeholder: 'gc-placeholder',
  openInEditor: 'gc-open-in-editor',
  prevChange: 'gc-prev-change',
  nextChange: 'gc-next-change',
  reviewBar: 'gc-review-bar',
  reviewSend: 'gc-review-send',
  reviewDiscard: 'gc-review-discard',
  commentCard: 'gc-comment-card',
} as const
