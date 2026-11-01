import { isAbsolute, join, normalize, sep } from 'node:path'
import type { ExtraResource } from '../../common/manifest'

export class UnknownModuleError extends Error {}
export class PathEscapeError extends Error {}

export interface ResourceModule {
  dir: string
  /** `from` is absolute (resolved against the declaring package or sub-package); `to` is module-relative. */
  extraResources: ExtraResource[]
}

export interface ResourcePaths {
  resource(moduleId: string, relPath: string): string
}

const PACKAGED_MODULES_DIR = 'modules'
const PARENT = '..'

function assertInside(rel: string, what: string): string {
  const clean = normalize(rel)
  if (isAbsolute(clean) || clean === PARENT || clean.startsWith(`${PARENT}${sep}`))
    throw new PathEscapeError(`${what} "${rel}" escapes the module root`)
  return clean
}

const matches = (rel: string, to: string): boolean => rel === to || rel.startsWith(`${to}/`)

/** `ctx.paths.resource`: dev maps `to` prefixes back to their `from`; packaged uses `resources/modules/<id>/<rel>`. */
export function createResourcePaths(opts: {
  isPackaged: boolean
  resourcesPath: string
  modules: Map<string, ResourceModule>
}): ResourcePaths {
  return {
    resource(moduleId, relPath) {
      const mod = opts.modules.get(moduleId)
      if (!mod) throw new UnknownModuleError(`unknown module ${moduleId}`)
      const rel = assertInside(relPath, 'resource path')
      if (opts.isPackaged) return join(opts.resourcesPath, PACKAGED_MODULES_DIR, moduleId, rel)
      const entries = mod.extraResources.map((e) => ({ from: e.from, to: assertInside(e.to, 'extraResources.to') }))
      const best = entries.filter((e) => matches(rel, e.to)).sort((a, b) => b.to.length - a.to.length)[0]
      return best ? join(best.from, rel.slice(best.to.length)) : join(mod.dir, rel)
    },
  }
}
