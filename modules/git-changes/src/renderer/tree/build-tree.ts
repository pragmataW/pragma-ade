import { DIR_ID_PREFIX, FILE_ID_PREFIX, GROUP_ID_PREFIX, STAGED_KEY_PREFIX } from '../../constants'
import type { ChangedFile } from '../../contract'

export const TREE_NODE_KINDS = ['dir', 'file', 'group'] as const
export type TreeNodeKind = (typeof TREE_NODE_KINDS)[number]
const [DIR, FILE, GROUP] = TREE_NODE_KINDS
/** The uncommitted mode's groups (VS Code: "Staged Changes", "Changes"). */
export const CHANGE_GROUPS = ['staged', 'unstaged'] as const
export type ChangeGroup = (typeof CHANGE_GROUPS)[number]
const [STAGED, UNSTAGED] = CHANGE_GROUPS

export interface TreeNode {
  id: string
  name: string
  /** Repo path (dirs, files); empty for a group. */
  path: string
  kind: TreeNodeKind
  children?: TreeNode[]
  file?: ChangedFile
  /** Inside the "Staged Changes" group. */
  staged?: boolean
  group?: ChangeGroup
  /** Descendant files (1 for a file). */
  fileCount: number
}

/** A list entry's identity: its path, prefixed for a staged entry (a path can be listed in both groups). */
export const entryKey = (file: Pick<ChangedFile, 'path' | 'staged'>): string =>
  file.staged ? STAGED_KEY_PREFIX + file.path : file.path

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

const stagedFlag = (staged: boolean): { staged?: true } => (staged ? { staged } : {})

const fileNode = (file: ChangedFile, name: string): TreeNode => ({
  id: FILE_ID_PREFIX + entryKey(file),
  name,
  path: file.path,
  kind: FILE,
  file,
  ...stagedFlag(file.staged === true),
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
function dirNode(name: string, path: string, draft: Draft, staged: boolean): TreeNode {
  let [label, at, dir] = [name, path, draft]
  for (let only = soleDir(dir); only; only = soleDir(dir)) {
    label = join(label, only[0])
    at = join(at, only[0])
    dir = only[1]
  }
  const children = nodesOf(dir, at, staged)
  const id = DIR_ID_PREFIX + (staged ? STAGED_KEY_PREFIX : '') + at
  return { id, name: label, path: at, kind: DIR, children, ...stagedFlag(staged), fileCount: countFiles(children) }
}

const soleDir = (d: Draft): [string, Draft] | undefined =>
  d.files.length === 0 && d.dirs.size === 1 ? [...d.dirs][0] : undefined
const countFiles = (nodes: TreeNode[]): number => nodes.reduce((n, c) => n + c.fileCount, 0)

function nodesOf(draft: Draft, prefix: string, staged: boolean): TreeNode[] {
  const dirs = [...draft.dirs]
    .sort(([a], [b]) => byName(a, b))
    .map(([name, d]) => dirNode(name, join(prefix, name), d, staged))
  const files = [...draft.files]
    .sort((a, b) => byName(baseName(a.path), baseName(b.path)))
    .map((f) => fileNode(f, baseName(f.path)))
  return [...dirs, ...files]
}

/** Indented tree: directories first, then files, each in `localeCompare('en')` order; single-dir chains merged. */
export const buildTree = (files: readonly ChangedFile[]): TreeNode[] =>
  nodesOf(draftOf(files), '', files.some((f) => f.staged))

/** Flat list: one leaf per file, named by its full path, in the given order. */
export const buildFlatList = (files: readonly ChangedFile[]): TreeNode[] => files.map((f) => fileNode(f, f.path))

const groupNode = (group: ChangeGroup, children: TreeNode[]): TreeNode => ({
  id: GROUP_ID_PREFIX + group,
  name: group,
  path: '',
  kind: GROUP,
  group,
  children,
  ...stagedFlag(group === STAGED),
  fileCount: countFiles(children),
})

/**
 * The tree (or flat list) of a change list. `grouped` (uncommitted mode): a "Staged Changes" group with the staged
 * entries, then a "Changes" group with the rest; a group without entries is left out.
 */
export function buildGroups(files: readonly ChangedFile[], opts: { grouped: boolean; flat: boolean }): TreeNode[] {
  const build = opts.flat ? buildFlatList : buildTree
  if (!opts.grouped) return build(files)
  const parts: [ChangeGroup, ChangedFile[]][] = [
    [STAGED, files.filter((f) => f.staged)],
    [UNSTAGED, files.filter((f) => !f.staged)],
  ]
  return parts.flatMap(([group, entries]) => (entries.length === 0 ? [] : [groupNode(group, build(entries))]))
}

/** Entry keys (`entryKey`) in display order (depth first). */
export const leafOrder = (nodes: readonly TreeNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === FILE && n.file ? [entryKey(n.file)] : leafOrder(n.children ?? [])))
