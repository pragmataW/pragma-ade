import { existsSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, extname, join, posix, relative, resolve, sep } from 'node:path'
import {
  DEFAULT_ENTRY,
  ELECTRON_MODULE,
  EXPORT_CONDITIONS,
  JS_EXTENSIONS,
  LIST_SEP,
  NODE_MODULES,
  NODE_PROTOCOL,
  PACKAGE_JSON,
  PARENT_SEGMENT,
  POSIX_SEP,
  RELATIVE_PREFIX,
  SCOPE_PREFIX,
  SPECIFIER_GROUP,
  SPECIFIER_PATTERNS,
  URL_SCHEME,
  UTF8,
  WORKSPACE_SCOPE,
} from '../constants.ts'
import { readJson, walkFiles } from './fsx.ts'
import { type ExternalRef, type PackageJson, PackageJsonSchema } from './schema.ts'

export type { ExternalRef } from './schema.ts'

export interface SpecifierHit {
  file: string
  specifier: string
}

export interface Rewrite {
  file: string
  from: string
  to: string
}

export interface ExternalScan {
  externals: ExternalRef[]
  rewrites: Rewrite[]
  unresolved: string[]
}

export class BundleError extends Error {}

const BUILTINS = new Set(builtinModules)
const TEMPLATE_HOLE = '${'
/** `@scope/name` */
const SCOPED_NAME_PARTS = 2

function specifiersIn(text: string): string[] {
  const found = new Map<string, string>()
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const specifier = m[SPECIFIER_GROUP]
      if (specifier && !specifier.includes(TEMPLATE_HOLE)) found.set(`${m.index}\0${specifier}`, specifier)
    }
  }
  return [...found.values()]
}

/** Literal specifiers of every require/import/export form in the given JS files. */
export const scanSpecifiers = (files: readonly string[]): SpecifierHit[] =>
  files.flatMap((file) => specifiersIn(readFileSync(file, UTF8)).map((specifier) => ({ file, specifier })))

const isRelative = (s: string): boolean => s.startsWith(RELATIVE_PREFIX)

/** npm package name of a bare specifier; null for builtins, `node:`, electron, relative, absolute and URLs. */
export function packageNameOf(specifier: string): string | null {
  if (!specifier || isRelative(specifier) || specifier.startsWith(POSIX_SEP) || specifier.startsWith(NODE_PROTOCOL))
    return null
  if (URL_SCHEME.test(specifier)) return null
  const parts = specifier.split(POSIX_SEP)
  const name = specifier.startsWith(SCOPE_PREFIX) ? parts.slice(0, SCOPED_NAME_PARTS).join(POSIX_SEP) : (parts[0] ?? '')
  if (name === ELECTRON_MODULE || BUILTINS.has(specifier) || BUILTINS.has(name)) return null
  return name
}

/** `exports['.']` (string or import/require/default), then `main`, then `index.js`; without a leading `./`. */
export function entryOf(pkg: PackageJson): string {
  const exp = pkg.exports
  const dot = typeof exp === 'string' ? exp : (exp as Record<string, unknown> | undefined)?.[RELATIVE_PREFIX]
  const pick = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v
    if (v && typeof v === 'object')
      for (const c of EXPORT_CONDITIONS) {
        const hit = pick((v as Record<string, unknown>)[c])
        if (hit) return hit
      }
    return undefined
  }
  return posix.normalize(pick(dot) ?? pkg.main ?? DEFAULT_ENTRY)
}

const readPkg = (dir: string): PackageJson => readJson(join(dir, PACKAGE_JSON), PackageJsonSchema)

/** Nearest ancestor dir of `path` whose package.json has a name (nested `{ "type": … }` files are skipped). */
export function packageRootOf(path: string): string | null {
  let dir = dirname(path)
  while (dir !== dirname(dir)) {
    const file = join(dir, PACKAGE_JSON)
    if (existsSync(file) && typeof JSON.parse(readFileSync(file, UTF8)).name === 'string') return dir
    dir = dirname(dir)
  }
  return null
}

/** Node's lookup: `<dir>/node_modules/<name>` from each search dir up to the filesystem root. */
function findInstalled(name: string, searchDirs: readonly string[]): string | null {
  for (const start of searchDirs) {
    let dir = resolve(start)
    while (true) {
      const candidate = join(dir, NODE_MODULES, name)
      if (existsSync(join(candidate, PACKAGE_JSON))) return candidate
      if (dir === dirname(dir)) break
      dir = dirname(dir)
    }
  }
  return null
}

const isInside = (root: string, path: string): boolean => {
  const rel = relative(root, path)
  return rel === '' || !(rel === PARENT_SEGMENT || rel.startsWith(`${PARENT_SEGMENT}${sep}`) || rel.startsWith(sep))
}
const toPosix = (p: string): string => p.split(sep).join(POSIX_SEP)

class ExternalCollector {
  readonly byName = new Map<string, ExternalRef>()
  readonly rewrites: Rewrite[] = []
  readonly unresolved = new Set<string>()

  add(ref: ExternalRef): void {
    const prev = this.byName.get(ref.name)
    if (prev && prev.version !== ref.version)
      throw new BundleError(`Conflicting versions for ${ref.name}: ${prev.version} vs ${ref.version}`)
    if (!prev) this.byName.set(ref.name, ref)
  }

  bare(hit: SpecifierHit, searchDirs: readonly string[]): void {
    const name = packageNameOf(hit.specifier)
    if (!name) return
    const dir = findInstalled(name, searchDirs)
    if (!dir) {
      this.unresolved.add(hit.specifier)
      return
    }
    const subpath = hit.specifier.slice(name.length + 1)
    this.add({ name, version: readPkg(dir).version ?? '', sourceDir: dir, subpath })
  }

  relativeOutside(hit: SpecifierHit, target: string): void {
    if (!toPosix(target).includes(`/${NODE_MODULES}/`))
      throw new BundleError(`bundle imports source outside out/: ${hit.specifier} (in ${hit.file})`)
    const root = packageRootOf(target)
    if (!root) throw new BundleError(`no package.json above ${target} (from ${hit.file})`)
    const pkg = readPkg(root)
    const subpath = toPosix(relative(root, target))
    this.add({ name: pkg.name, version: pkg.version ?? '', sourceDir: root, subpath })
    const to = subpath === entryOf(pkg) ? pkg.name : `${pkg.name}/${subpath}`
    this.rewrites.push({ file: hit.file, from: hit.specifier, to })
  }
}

const isJs = (file: string): boolean => (JS_EXTENSIONS as readonly string[]).includes(extname(file))

/** Externals of the given JS files of a bundle rooted at `bundleRoot` (relative targets outside it are external). */
export function analyzeFiles(
  bundleRoot: string,
  files: readonly string[],
  searchDirs: readonly string[],
): ExternalScan {
  const root = resolve(bundleRoot)
  const c = new ExternalCollector()
  for (const hit of scanSpecifiers(files)) {
    if (!isRelative(hit.specifier)) c.bare(hit, searchDirs)
    else {
      const target = resolve(dirname(hit.file), hit.specifier)
      if (!isInside(root, target)) c.relativeOutside(hit, target)
    }
  }
  return { externals: [...c.byName.values()], rewrites: c.rewrites, unresolved: [...c.unresolved].sort() }
}

/**
 * Externals of a built bundle: bare imports resolved from `searchDirs`, relative imports into node_modules rewritten.
 * `skipDirs` names folders that never run in Node (the renderer bundle).
 */
export function analyzeBundle(
  bundleRoot: string,
  searchDirs: readonly string[],
  opts: { skipDirs?: readonly string[] } = {},
): ExternalScan {
  const files = walkFiles(bundleRoot, { skipDirs: [NODE_MODULES, ...(opts.skipDirs ?? [])] }).filter(isJs)
  return analyzeFiles(bundleRoot, files, searchDirs)
}

/** Workspace packages must be bundled, never loaded at runtime. */
export function assertNoWorkspaceExternals(scan: ExternalScan): void {
  const bad = scan.externals.filter((e) => e.name.startsWith(WORKSPACE_SCOPE)).map((e) => e.name)
  if (bad.length > 0) throw new BundleError(`workspace packages are external in the bundle: ${bad.join(LIST_SEP)}`)
}
