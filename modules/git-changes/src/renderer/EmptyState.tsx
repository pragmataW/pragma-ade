import { useT } from '@pragma/sdk/renderer'
import { EmptyState as UiEmptyState } from '@pragma/ui'
import { EMPTY_ICONS } from '../constants'
import { GitChangesTestIds as T } from '../contract'

export const EMPTY_KINDS = {
  noWorktree: 'noWorktree',
  loading: 'loading',
  failed: 'failed',
  noChanges: 'noChanges',
} as const
export type EmptyKind = (typeof EMPTY_KINDS)[keyof typeof EMPTY_KINDS]

const COPY = {
  noWorktree: {
    icon: EMPTY_ICONS.noWorktree,
    title: 'git-changes:empty.noWorktreeTitle',
    description: 'git-changes:empty.noWorktree',
  },
  loading: { icon: EMPTY_ICONS.loading, title: 'git-changes:empty.loading', description: undefined },
  failed: {
    icon: EMPTY_ICONS.failed,
    title: 'git-changes:errors.loadFailed',
    description: 'git-changes:empty.failedHint',
  },
  noChanges: {
    icon: EMPTY_ICONS.noChanges,
    title: 'git-changes:empty.noChanges',
    description: 'git-changes:empty.noChangesHint',
  },
} as const satisfies Record<EmptyKind, { icon: string; title: string; description: string | undefined }>

/** The panel body when there is nothing to list: no worktree, loading, failed or a clean tree. */
export function EmptyState({ kind }: { kind: EmptyKind }) {
  const t = useT()
  const copy = COPY[kind]
  return (
    <UiEmptyState
      testId={T.empty}
      data-kind={kind}
      icon={copy.icon}
      title={t(copy.title)}
      description={copy.description ? t(copy.description) : undefined}
      busy={kind === EMPTY_KINDS.loading}
      error={kind === EMPTY_KINDS.failed}
    />
  )
}
