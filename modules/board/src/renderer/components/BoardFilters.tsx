import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { MENU_ALIGN, NO_AGENT_FILTER_VALUE, SIZE, VARIANT, WORKTREE_FILTERS } from '../../constants'
import { BOARD_TESTID_ATTRS as A, PRIORITIES, BOARD_TESTIDS as T } from '../../contract'
import { columnMergeKey } from '../../lib/merge-columns'
import { profileLabel } from '../lib/labels'
import { agentFilterOptions, isFilterActive, WORKTREE_FILTER, WorktreeFilterSchema } from '../model'
import { clearFilter, setFilter, useBoardStore } from '../store'
import { FilterChip } from './FilterChip'

const WORKTREE_LABEL_KEYS = {
  any: 'board:filter.worktreeAny',
  with: 'board:filter.worktreeWith',
  without: 'board:filter.worktreeWithout',
} as const

/** Label names merged across the scope's boards (case-insensitive, first spelling). */
function useLabelNames(): string[] {
  const sections = useBoardStore((s) => s.snapshot?.sections) ?? []
  const byKey = new Map<string, string>()
  for (const l of sections.flatMap((s) => s.labels))
    if (!byKey.has(columnMergeKey(l.name))) byKey.set(columnMergeKey(l.name), l.name)
  return [...byKey.values()]
}

function WorktreeFilterChip() {
  const t = useT()
  const value = useBoardStore((s) => s.filter.worktree)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-testid={T.filterWorktree} variant={VARIANT.outline} size={SIZE.sm}>
          {value === WORKTREE_FILTER.any ? t('board:filter.worktree') : t(WORKTREE_LABEL_KEYS[value])}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={MENU_ALIGN.start}>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => setFilter({ worktree: WorktreeFilterSchema.parse(v) })}
        >
          {WORKTREE_FILTERS.map((w) => (
            <DropdownMenuRadioItem key={w} value={w} data-testid={T.filterOption} {...{ [A.value]: w }}>
              {t(WORKTREE_LABEL_KEYS[w])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Label / Priority / Agent / Worktree chips and Clear (filters live in the store only). */
export function BoardFilters() {
  const t = useT()
  const filter = useBoardStore((s) => s.filter)
  const tasks = useBoardStore((s) => s.snapshot?.tasks) ?? []
  const labels = useLabelNames()
  const agents = [
    ...agentFilterOptions({ tasks }).map((o) => ({ value: o.profileId, label: profileLabel(t, o) })),
    { value: NO_AGENT_FILTER_VALUE, label: t('board:filter.noAgent') },
  ]
  return (
    <div className="flex items-center gap-1.5">
      <FilterChip
        testId={T.filterLabels}
        label={t('board:filter.labels')}
        options={labels.map((l) => ({ value: l, label: l }))}
        selected={filter.labelNames}
        onChange={(labelNames) => setFilter({ labelNames })}
      />
      <FilterChip
        testId={T.filterPriority}
        label={t('board:filter.priority')}
        options={PRIORITIES.map((p) => ({ value: p, label: t(`board:priority.${p}`) }))}
        selected={filter.priorities}
        onChange={(v) => setFilter({ priorities: PRIORITIES.filter((p) => v.includes(p)) })}
      />
      <FilterChip
        testId={T.filterAgent}
        label={t('board:filter.agent')}
        options={agents}
        selected={filter.agents}
        onChange={(v) => setFilter({ agents: v })}
      />
      <WorktreeFilterChip />
      {isFilterActive(filter) && (
        <Button data-testid={T.filterClear} variant={VARIANT.ghost} size={SIZE.sm} onClick={clearFilter}>
          {t('board:filter.clear')}
        </Button>
      )}
    </div>
  )
}
