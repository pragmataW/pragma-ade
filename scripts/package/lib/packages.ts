import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { NODE_MODULES, PACKAGE_JSON, SCOPE_PREFIX, UTF8 } from '../constants.ts'
import { isDir } from './fsx.ts'

/** The few package.json fields read from installed packages (anything else is ignored). */
export const PackageMetaSchema = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    type: z.string().optional(),
    optionalDependencies: z.record(z.string(), z.string()).optional(),
  })
  .loose()
export type PackageMeta = z.infer<typeof PackageMetaSchema>

/** package.json of a dir, or null when it is missing or not an object. */
export function readPackageMeta(dir: string): PackageMeta | null {
  const file = join(dir, PACKAGE_JSON)
  if (!existsSync(file)) return null
  const parsed = PackageMetaSchema.safeParse(JSON.parse(readFileSync(file, UTF8)))
  return parsed.success ? parsed.data : null
}

/** Every installed package dir below a node_modules dir (scoped and nested ones included). */
export function packageDirs(nodeModulesDir: string): string[] {
  if (!existsSync(nodeModulesDir)) return []
  const out: string[] = []
  for (const name of readdirSync(nodeModulesDir)) {
    const path = join(nodeModulesDir, name)
    if (!isDir(path)) continue
    const dirs = name.startsWith(SCOPE_PREFIX) ? readdirSync(path).map((n) => join(path, n)) : [path]
    for (const dir of dirs.filter(isDir)) out.push(dir, ...packageDirs(join(dir, NODE_MODULES)))
  }
  return out
}
