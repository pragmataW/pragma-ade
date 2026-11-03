import { COMMENT_SOURCE, type Comment } from '../../contract'

export const THREAD_GROUP_KINDS = ['file', 'page'] as const
export type ThreadGroupKind = (typeof THREAD_GROUP_KINDS)[number]
const [FILE, PAGE] = THREAD_GROUP_KINDS

/** The threads of one file (editor and diff together) or one browser page, in their given order. */
export interface ThreadGroup {
  kind: ThreadGroupKind
  /** The file path or the page URL. */
  key: string
  threads: Comment[]
}

const groupOf = (c: Comment): Pick<ThreadGroup, 'kind' | 'key'> =>
  c.source === COMMENT_SOURCE.browser
    ? { kind: PAGE, key: c.element?.url ?? '' }
    : { kind: FILE, key: c.filePath ?? '' }

/** Groups keep the order of their first thread; threads keep theirs. */
export function groupThreads(threads: readonly Comment[]): ThreadGroup[] {
  const groups = new Map<string, ThreadGroup>()
  for (const c of threads) {
    const { kind, key } = groupOf(c)
    const id = `${kind}:${key}`
    const group = groups.get(id) ?? { kind, key, threads: [] }
    group.threads.push(c)
    groups.set(id, group)
  }
  return [...groups.values()]
}

/** `host/path` of a page URL (the URL itself when it does not parse). */
export function pageLabel(url: string): string {
  try {
    const u = new URL(url)
    return `${u.host}${u.pathname}`
  } catch {
    return url
  }
}

const SLASH = '/'
/** `src/lib/` and `a.ts` of `src/lib/a.ts`. */
export function splitPath(path: string): { dir: string; base: string } {
  const cut = path.lastIndexOf(SLASH) + 1
  return { dir: path.slice(0, cut), base: path.slice(cut) }
}
