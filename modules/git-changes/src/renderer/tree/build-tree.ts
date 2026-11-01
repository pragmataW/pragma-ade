import { DIR_ID_PREFIX, FILE_ID_PREFIX } from '../../constants'
import type { ChangedFile } from '../../contract'

export const TREE_NODE_KINDS = ['dir', 'file'] as const
export type TreeNodeKind = (typeof TREE_NODE_KINDS)[number]
const [DIR, FILE] = TREE_NODE_KINDS

export interface TreeNode {
  id: string
  name: string
  path: string
  kind: TreeNodeKind
  children?: TreeNode[]
  file?: ChangedFile
  /** Descendant files (1 for a file). */
  fileCount: number
}

interface Draft {
  dirs: Map<string, Draft>
  files: ChangedFile[]
}

const SEPARATOR = '/'
const LOCALE = 'en'
const byName = (a: string, b: string): number => a.localeCompare(b, LOCALE)
const baseName = (path: string): string => path.slice(path.lastIndexOf(SEPARATOR) + 1)
const join = (prefix: string, name: string): string => (prefix ? `${prefix}${SEPARATOR}${name}` : name)
const emptyDraft = (): Draft => ({ dirs: new Map(), files: [] })

const fileNode = (file: ChangedFile, name: string): TreeNode => ({
  id: FILE_ID_PREFIX + file.path,
  name,
  path: file.path,
  kind: FILE,
  file,
  fileCount: 1,
})

function draftOf(files: readonly ChangedFile[]): Draft {
  const root = emptyDraft()
  for (const file of files) {
    const segments = file.path.split(SEPARATOR)
    segments.pop()
    let dir = root
    for (const segment of segments) {
      const next = dir.dirs.get(segment) ?? emptyDraft()
      dir.dirs.set(segment, next)
      dir = next
    }
    dir.files.push(file)
  }
  return root
}

/** A directory node; a directory whose only child is a directory absorbs it (`main/git`). */
function dirNode(name: string, path: string, draft: Draft): TreeNode {
  let [label, at, dir] = [name, path, draft]
  for (let only = soleDir(dir); only; only = soleDir(dir)) {
    label = join(label, only[0])
    at = join(at, only[0])
    dir = only[1]
  }
  const children = nodesOf(dir, at)
  return { id: DIR_ID_PREFIX + at, name: label, path: at, kind: DIR, children, fileCount: countFiles(children) }
}

const soleDir = (d: Draft): [string, Draft] | undefined =>
  d.files.length === 0 && d.dirs.size === 1 ? [...d.dirs][0] : undefined
const countFiles = (nodes: TreeNode[]): number => nodes.reduce((n, c) => n + c.fileCount, 0)

function nodesOf(draft: Draft, prefix: string): TreeNode[] {
  const dirs = [...draft.dirs].sort(([a], [b]) => byName(a, b)).map(([name, d]) => dirNode(name, join(prefix, name), d))
  const files = [...draft.files]
    .sort((a, b) => byName(baseName(a.path), baseName(b.path)))
    .map((f) => fileNode(f, baseName(f.path)))
  return [...dirs, ...files]
}

/** Indented tree: directories first, then files, each in `localeCompare('en')` order; single-dir chains merged. */
export const buildTree = (files: readonly ChangedFile[]): TreeNode[] => nodesOf(draftOf(files), '')

/** Flat list: one leaf per file, named by its full path, in the given order. */
export const buildFlatList = (files: readonly ChangedFile[]): TreeNode[] => files.map((f) => fileNode(f, f.path))

/** File paths in display order (depth first). */
export const leafOrder = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === FILE ? [n.path] : leafOrder(n.children ?? [])))
