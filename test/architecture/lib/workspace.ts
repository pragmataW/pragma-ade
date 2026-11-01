import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { globSync } from 'tinyglobby'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export interface WorkspaceYaml {
  packages: string[]
  allowBuilds: Record<string, boolean>
}

export interface PackageJson {
  name: string
  version?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  pragma?: unknown
}

const LIST_ITEM = /^\s+-\s+(.+)$/
const MAP_ITEM = /^\s+"?([^":]+)"?:\s*(.+)$/
const SECTION = /^([A-Za-z]+):\s*$/

const unquote = (s: string): string => s.trim().replace(/^["']|["']$/g, '')

/** Tiny line parser for the subset of YAML used by pnpm-workspace.yaml. */
export function readWorkspaceYaml(rel: string, root = REPO_ROOT): WorkspaceYaml {
  const out: WorkspaceYaml = { packages: [], allowBuilds: {} }
  let section = ''
  for (const line of readFileSync(join(root, rel), 'utf8').split('\n')) {
    const head = SECTION.exec(line)
    if (head?.[1]) {
      section = head[1]
      continue
    }
    const item = LIST_ITEM.exec(line)
    if (section === 'packages' && item?.[1]) out.packages.push(unquote(item[1]))
    const entry = MAP_ITEM.exec(line)
    if (section === 'allowBuilds' && entry?.[1] && entry[2])
      out.allowBuilds[unquote(entry[1])] = unquote(entry[2]) === 'true'
  }
  return out
}

export const readPackageJson = (file: string): PackageJson => JSON.parse(readFileSync(file, 'utf8')) as PackageJson

export function workspacePackageDirs(root = REPO_ROOT): string[] {
  const { packages } = readWorkspaceYaml('pnpm-workspace.yaml', root)
  const files = globSync(
    packages.map((p) => `${p}/package.json`),
    { cwd: root, ignore: ['**/node_modules/**'], absolute: true },
  )
  return files.map((f) => dirname(f)).sort()
}

export function allWorkspacePackageJsons(root = REPO_ROOT): PackageJson[] {
  return [join(root, 'package.json'), ...workspacePackageDirs(root).map((d) => join(d, 'package.json'))].map(
    readPackageJson,
  )
}
