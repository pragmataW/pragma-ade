import { useMemo } from 'react'
import { SCOPE_KIND } from '../../contract'
import type { TaskPredicate } from '../../lib/filter'
import { mergeColumns } from '../../lib/merge-columns'
import { type BoardColumnModel, buildPredicate, groupTasks } from '../model'
import { useBoardStore } from '../store'

/** Columns of the scope: the board's own, or the All-projects merge. */
export function useColumns(): BoardColumnModel[] {
  const snapshot = useBoardStore((s) => s.snapshot)
  return useMemo(() => {
    if (!snapshot) return []
    if (snapshot.scope.kind === SCOPE_KIND.all) return mergeColumns(snapshot.sections)
    return snapshot.sections[0]?.columns ?? []
  }, [snapshot])
}

export function usePredicate(): TaskPredicate {
  const filter = useBoardStore((s) => s.filter)
  const sections = useBoardStore((s) => s.snapshot?.sections)
  return useMemo(() => buildPredicate(filter, sections ?? []), [filter, sections])
}

/** Visible tasks per column key. */
export function useGroupedTasks(columns: BoardColumnModel[]) {
  const snapshot = useBoardStore((s) => s.snapshot)
  const predicate = usePredicate()
  return useMemo(() => groupTasks({ tasks: snapshot?.tasks ?? [] }, columns, predicate), [snapshot, columns, predicate])
}

export const useIsAllScope = (): boolean => useBoardStore((s) => s.snapshot?.scope.kind === SCOPE_KIND.all)
