import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { EDITOR_OPEN_FILE_COMMAND, GIT_CHANGES_REVEAL_COMMAND } from '../../../../constants'
import type { ChatSessionApi } from '../../../../contract'
import { useChatHost } from '../../../host-adapter'
import { type FileRef, parseFileRef } from '../../../lib/parse-file-ref'

export interface FileLinks {
  /** The reference when it is an in-worktree file and `editor.openFile` exists, else null (plain text). */
  refOf(raw: string): FileRef | null
  open(ref: FileRef): void
  /** Only with `gitChanges.reveal` (07). */
  reveal: ((path: string) => void) | null
}

/** File references of a chat session: links only when the editor (06) / Git Changes (07) commands are registered. */
export function useFileLinks(session: Pick<ChatSessionApi, 'worktree'>): FileLinks {
  const host = useChatHost()
  // commands of other modules arrive asynchronously: re-check `has` whenever they change
  const [commandsVersion, commandsChanged] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const sub = host.commands.onChange(commandsChanged)
    return () => sub.dispose()
  }, [host])
  void commandsVersion
  const worktree = session.worktree
  const canOpen = worktree !== undefined && host.commands.has(EDITOR_OPEN_FILE_COMMAND)
  const canReveal = worktree !== undefined && host.commands.has(GIT_CHANGES_REVEAL_COMMAND)
  const run = useCallback(
    (id: string, args: object) => {
      if (!worktree) return
      host.commands
        .execute(id, { worktreeId: worktree.id, ...args })
        .catch((e: unknown) => console.warn(`chat: ${id} failed`, e))
    },
    [host, worktree],
  )
  return useMemo(
    () => ({
      refOf: (raw) => (canOpen && worktree ? parseFileRef(raw, worktree.path) : null),
      open: (ref) => run(EDITOR_OPEN_FILE_COMMAND, ref),
      reveal: canReveal ? (path) => run(GIT_CHANGES_REVEAL_COMMAND, { path }) : null,
    }),
    [canOpen, canReveal, worktree, run],
  )
}
