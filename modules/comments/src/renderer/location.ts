import { COMMENT_SOURCE, type Comment } from '../contract'
import { codeLocation } from '../lib/code-location'

/** `path:start-end` for code comments, the selector for browser comments. */
export function locationLabel(c: Pick<Comment, 'source' | 'filePath' | 'lineStart' | 'lineEnd' | 'element'>): string {
  switch (c.source) {
    case COMMENT_SOURCE.editor:
    case COMMENT_SOURCE.diff:
      return codeLocation(c)
    case COMMENT_SOURCE.browser:
      return c.element?.selector ?? ''
    default: {
      const never: never = c.source
      throw new Error(`unknown comment source ${String(never)}`)
    }
  }
}
