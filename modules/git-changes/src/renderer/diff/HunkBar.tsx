import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { useMemo } from 'react'
import { VARIANT_GHOST } from '../../constants'
import { type ChangedFile, FILE_STATUS, HUNK_ACTIONS, type HunkAction, GitChangesTestIds as T } from '../../contract'
import { scmActions } from '../scm/actions'
import { useHunks } from '../scm/use-scm'

const [STAGE, UNSTAGE, DISCARD] = HUNK_ACTIONS
const SIZE_XS = 'xs'
const STAGED_ACTIONS: HunkAction[] = [UNSTAGE]
const UNSTAGED_ACTIONS: HunkAction[] = [DISCARD, STAGE]

/**
 * The entry's git hunks above the diff, each with Stage / Discard (a "Changes" entry) or Unstage (a staged one). An
 * untracked or binary file has none: it is staged or discarded whole.
 */
export function HunkBar({ worktreeId, file }: { worktreeId: string; file: ChangedFile }) {
  const t = useT()
  const hunks = useHunks(worktreeId, file.status === FILE_STATUS.U || file.binary ? null : file)
  const actions = useMemo(() => scmActions(worktreeId), [worktreeId])
  if (hunks.length === 0) return null
  const available = file.staged ? STAGED_ACTIONS : UNSTAGED_ACTIONS
  return (
    <div
      data-testid={T.hunks}
      className="max-h-32 shrink-0 overflow-auto border-[var(--bd)] border-b bg-[var(--pn)] px-2 py-0.5"
    >
      {hunks.map((h) => (
        <div key={h.header} data-header={h.header} className="flex h-6 items-center gap-2 font-mono text-[11px]">
          <span className="truncate text-muted-foreground">{h.header}</span>
          <span className="ml-auto flex shrink-0 gap-0.5 font-sans">
            {available.map((action) => (
              <Button
                key={action}
                size={SIZE_XS}
                variant={VARIANT_GHOST}
                data-testid={T.hunkAction(action)}
                onClick={() => void actions.applyHunk(file.path, action, h.header)}
                className="px-1.5 text-[11px]"
              >
                {t(`git-changes:scm.hunk.${action}`)}
              </Button>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}
