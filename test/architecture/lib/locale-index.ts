import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { discoverModules } from '../../../scripts/lib/discover.ts'
import { isPlainObject } from '../../../scripts/lib/objects.ts'
import { moduleLocales } from '../../../scripts/lib/render.ts'

export type LocaleIndex = Map<string, Set<string>>

const CORE_NAMESPACE = 'core'
const ENGLISH = 'en'
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function flatten(tree: unknown, prefix: string, out: Set<string>): void {
  if (!isPlainObject(tree)) {
    out.add(prefix)
    out.add(prefix.replace(PLURAL_SUFFIX, ''))
    return
  }
  for (const [key, value] of Object.entries(tree)) flatten(value, prefix ? `${prefix}.${key}` : key, out)
}

/** English keys per namespace: every module/provider (merged per capability) plus the shell's `core`. */
export function buildLocaleIndex(root: string): LocaleIndex {
  const index: LocaleIndex = new Map()
  const add = (ns: string, tree: unknown) => {
    const keys = new Set<string>()
    flatten(tree, '', keys)
    index.set(ns, keys)
  }
  const coreFile = join(root, 'apps/desktop/locales', `${ENGLISH}.json`)
  add(CORE_NAMESPACE, existsSync(coreFile) ? JSON.parse(readFileSync(coreFile, 'utf8')) : {})
  for (const mod of discoverModules({ repoRoot: root, includeUnderscored: true }))
    add(mod.id, moduleLocales(mod).locales[ENGLISH] ?? {})
  return index
}

export function resolvesKey(index: LocaleIndex, key: string): boolean {
  const [ns, path] = key.split(':') as [string, string | undefined]
  return path !== undefined && (index.get(ns)?.has(path) ?? false)
}
