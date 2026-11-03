import { FileCode, GitCompare, Globe } from '@pragma/ui/icons'
import { useEffect, useReducer } from 'react'
import { BROWSER_OPEN_COMMAND, EDITOR_OPEN_FILE_COMMAND, GIT_CHANGES_REVEAL_COMMAND } from '../constants'
import { COMMENT_SOURCE, type Comment, DIFF_SIDE, COMMENTS_TESTIDS as T, type ThreadLink } from '../contract'
import { runtime } from './runtime'
import { useCommentsStore } from './store'

/** Re-renders whenever the command registry changes (other modules register theirs asynchronously). */
function useCommandsVersion(): number {
  const [version, bump] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const sub = runtime().commands.onChange(bump)
    return () => sub.dispose()
  }, [])
  return version
}

interface LinkSpec extends Omit<ThreadLink, 'onSelect'> {
  command: string
  args: object
}

const editorLink = (c: Comment, path: string): LinkSpec => ({
  id: 'editor',
  labelKey: 'comments:links.openInEditor',
  icon: FileCode,
  testId: T.linkEditor,
  command: EDITOR_OPEN_FILE_COMMAND,
  args: { worktreeId: c.worktreeId, path, line: c.lineStart },
})

/** Where a thread can jump to, first = the location label's target. */
function linkSpecs(c: Comment): LinkSpec[] {
  switch (c.source) {
    case COMMENT_SOURCE.editor:
      return c.filePath ? [editorLink(c, c.filePath)] : []
    case COMMENT_SOURCE.diff: {
      if (!c.filePath) return []
      const reveal: LinkSpec = {
        id: 'gitChanges',
        labelKey: 'comments:links.showInGitChanges',
        icon: GitCompare,
        testId: T.linkGitChanges,
        command: GIT_CHANGES_REVEAL_COMMAND,
        args: { worktreeId: c.worktreeId, path: c.filePath, line: c.lineStart, side: c.diffSide, commentId: c.id },
      }
      return c.diffSide === DIFF_SIDE.old ? [reveal] : [reveal, editorLink(c, c.filePath)]
    }
    case COMMENT_SOURCE.browser: {
      const url = c.element?.url
      if (!url) return []
      const args = { worktreeId: c.worktreeId, url }
      return [
        {
          id: 'browser',
          labelKey: 'comments:links.openPage',
          icon: Globe,
          testId: T.linkBrowser,
          command: BROWSER_OPEN_COMMAND,
          args,
        },
      ]
    }
    default: {
      const never: never = c.source
      throw new Error(`unknown comment source ${String(never)}`)
    }
  }
}

/** Closes the drawer (it overlays the targets), then runs the command; failures are logged. */
function follow(spec: LinkSpec): void {
  useCommentsStore.getState().closeDrawer()
  runtime()
    .commands.execute(spec.command, spec.args)
    .catch((e: unknown) => console.warn(`comments: ${spec.command} failed`, e))
}

/** The drawer's links of one thread: only those whose command is registered (editor, Git Changes, browser). */
export function useThreadLinks(comment: Comment): ThreadLink[] {
  useCommandsVersion()
  const { commands } = runtime()
  return linkSpecs(comment)
    .filter((s) => commands.has(s.command))
    .map((s) => ({ id: s.id, labelKey: s.labelKey, icon: s.icon, testId: s.testId, onSelect: () => follow(s) }))
}
