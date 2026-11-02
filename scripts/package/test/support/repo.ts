import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkTemp } from '../../lib/fsx.ts'

export const WORKSPACE_YAML = [
  'packages:',
  '  - apps/*',
  '  - modules/*',
  '  - modules/*/packages/*',
  '  - providers/*',
  '  - providers/*/packages/*',
  '',
].join('\n')

/** Writes files (objects as JSON) below `root`. */
export function writeTree(root: string, files: Record<string, string | object>): string {
  for (const [rel, content] of Object.entries(files)) {
    const path = join(root, rel)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`)
  }
  return root
}

/** A temp repo (path with a space) with the given files; `pnpm-workspace.yaml` defaults to `WORKSPACE_YAML`. */
export const makeRepo = (files: Record<string, string | object>, label = 'ws root'): string =>
  writeTree(mkTemp(label), { 'pnpm-workspace.yaml': WORKSPACE_YAML, ...files })

/** A package.json object. */
export const pkg = (name: string, pragma?: object, extra: object = {}): object => ({
  name,
  version: '1.0.0',
  ...(pragma ? { pragma } : {}),
  ...extra,
})

/** `pragma.package.extraResources` for the given entries. */
export const resources = (...entries: { from: string; to: string }[]) => ({ package: { extraResources: entries } })
