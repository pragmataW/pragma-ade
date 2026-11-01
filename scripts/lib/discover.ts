import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, delimiter, isAbsolute, join, relative, resolve } from 'node:path'
import {
  type ModuleManifest,
  ModuleManifestSchema,
  type SubPackageManifest,
  SubPackageManifestSchema,
} from '../../packages/sdk/src/common/manifest.ts'
import { CAPABILITY_FILE_PATTERN, MIGRATION_NAME_PATTERN } from '../../packages/sdk/src/common/patterns.ts'
import {
  CAPABILITY_SUFFIX,
  DEFAULT_MODULE_ROOTS,
  ENGLISH,
  ENTRY_EXPORTS,
  EXTRA_ROOTS_ENV,
  JSON_EXT,
  LOCALES_DIR,
  MAIN_CAPABILITY_EXT,
  MIGRATIONS_DIR,
  MODULE_PACKAGE_PREFIX,
  PROVIDER_FILES,
  PROVIDER_KIND,
  PROVIDER_LOCALE_FILE,
  PROVIDER_PACKAGE_PREFIX,
  RENDERER_CAPABILITY_EXT,
  SQL_EXT,
  SUB_PACKAGES_DIR,
  TEST_HOOKS_FILE,
  UTF8,
} from './constants.ts'
import { GenerateError } from './errors.ts'
import { checkMigrationDeps } from './migration-deps.ts'
import { PACKAGE_JSON } from './packages.ts'

export interface CapabilityFile {
  key: string
  file: string
}

export interface DiscoveredModule {
  id: string
  dir: string
  packageName: string
  version: string
  manifest: ModuleManifest
  scripts: Record<string, string>
  mainEntry?: string
  rendererEntry?: string
  contractEntry?: string
  migrations: string[]
  locales: Record<string, string[]>
  testHooks?: string
  subPackages: { dir: string; manifest: SubPackageManifest; scripts: Record<string, string> }[]
  provider?: {
    descriptorFile: string
    iconFile?: string
    settingsFile?: string
    mainCapabilities: CapabilityFile[]
    rendererCapabilities: CapabilityFile[]
  }
}

interface PackageJsonShape {
  name?: string
  version?: string
  scripts?: Record<string, string>
  exports?: Record<string, string>
  pragma?: unknown
}

interface Inspection {
  module?: DiscoveredModule
  problems: string[]
}

const readPackage = (dir: string): PackageJsonShape =>
  JSON.parse(readFileSync(join(dir, PACKAGE_JSON), UTF8)) as PackageJsonShape
const listDir = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir).sort() : [])
const isDir = (p: string): boolean => existsSync(p) && statSync(p).isDirectory()
const optionalFile = (dir: string, rel: string): string | undefined =>
  existsSync(join(dir, rel)) ? join(dir, rel) : undefined
const skipFolder = (name: string, includeUnderscored: boolean): boolean =>
  name.startsWith('.') || (name.startsWith('_') && !includeUnderscored)

function optionalTarget(dir: string, pkg: PackageJsonShape, key: string): string | undefined {
  const target = pkg.exports?.[key]
  return target === undefined ? undefined : join(dir, target)
}

function entryFiles(dir: string, pkg: PackageJsonShape, problems: string[]) {
  for (const [key, target] of Object.entries(pkg.exports ?? {}))
    if (!existsSync(join(dir, target))) problems.push(`export ${key} → ${target} does not exist`)
  return {
    mainEntry: optionalTarget(dir, pkg, ENTRY_EXPORTS.main),
    rendererEntry: optionalTarget(dir, pkg, ENTRY_EXPORTS.renderer),
    contractEntry: optionalTarget(dir, pkg, ENTRY_EXPORTS.contract),
  }
}

function migrationFiles(dir: string, problems: string[]): string[] {
  const files = listDir(join(dir, MIGRATIONS_DIR)).filter((f) => f.endsWith(SQL_EXT))
  for (const f of files)
    if (!MIGRATION_NAME_PATTERN.test(f)) problems.push(`invalid migration name ${f} (NNNN_name.sql)`)
  return files.map((f) => join(dir, MIGRATIONS_DIR, f))
}

function localeFiles(dir: string, isProvider: boolean, problems: string[]): Record<string, string[]> {
  const root = join(dir, LOCALES_DIR)
  const out: Record<string, string[]> = {}
  for (const entry of listDir(root)) {
    if (isProvider && isDir(join(root, entry)))
      out[entry] = listDir(join(root, entry))
        .filter((f) => f.endsWith(JSON_EXT))
        .map((f) => join(root, entry, f))
    else if (!isProvider && entry.endsWith(JSON_EXT)) out[basename(entry, JSON_EXT)] = [join(root, entry)]
  }
  const english = out[ENGLISH] ?? []
  const required = isProvider
    ? join(LOCALES_DIR, ENGLISH, PROVIDER_LOCALE_FILE)
    : join(LOCALES_DIR, `${ENGLISH}${JSON_EXT}`)
  if (!english.includes(join(dir, required))) problems.push(`missing English locale ${required}`)
  return out
}

function capabilityFiles(dir: string, sub: string, ext: string, problems: string[]): CapabilityFile[] {
  const out: CapabilityFile[] = []
  for (const name of listDir(join(dir, sub)).filter((f) => CAPABILITY_SUFFIX.test(f))) {
    const key = CAPABILITY_FILE_PATTERN.exec(name)?.groups?.key
    if (!key || !name.endsWith(`.capability${ext}`)) problems.push(`invalid capability file name ${sub}/${name}`)
    else out.push({ key, file: join(dir, sub, name) })
  }
  return out
}

function providerFiles(dir: string, problems: string[]): DiscoveredModule['provider'] {
  const descriptorFile = join(dir, PROVIDER_FILES.descriptor)
  if (!existsSync(descriptorFile)) problems.push(`provider has no ${PROVIDER_FILES.descriptor}`)
  return {
    descriptorFile,
    iconFile: optionalFile(dir, PROVIDER_FILES.icon),
    settingsFile: optionalFile(dir, PROVIDER_FILES.settings),
    mainCapabilities: capabilityFiles(dir, PROVIDER_FILES.mainDir, MAIN_CAPABILITY_EXT, problems),
    rendererCapabilities: capabilityFiles(dir, PROVIDER_FILES.rendererDir, RENDERER_CAPABILITY_EXT, problems),
  }
}

function subPackages(dir: string, problems: string[]): DiscoveredModule['subPackages'] {
  const root = join(dir, SUB_PACKAGES_DIR)
  const out: DiscoveredModule['subPackages'] = []
  for (const name of listDir(root)) {
    const subDir = join(root, name)
    if (!existsSync(join(subDir, PACKAGE_JSON))) continue
    const pkg = readPackage(subDir)
    const parsed = SubPackageManifestSchema.safeParse(pkg.pragma ?? {})
    if (!parsed.success) problems.push(`${SUB_PACKAGES_DIR}/${name}: invalid pragma manifest: ${parsed.error.message}`)
    else out.push({ dir: subDir, manifest: parsed.data, scripts: pkg.scripts ?? {} })
  }
  return out
}

function checkIdentity(dir: string, manifest: ModuleManifest, pkg: PackageJsonShape, problems: string[]): void {
  const folder = basename(dir)
  if (!folder.startsWith('_') && folder !== manifest.id)
    problems.push(`id "${manifest.id}" does not match folder name "${folder}"`)
  const prefix = manifest.kind === PROVIDER_KIND ? PROVIDER_PACKAGE_PREFIX : MODULE_PACKAGE_PREFIX
  if (pkg.name !== `${prefix}${manifest.id}`) problems.push(`package name must be ${prefix}${manifest.id}`)
}

function checkBuildScripts(mod: DiscoveredModule, problems: string[]): void {
  const check = (build: string | undefined, scripts: Record<string, string>, where: string) => {
    if (build !== undefined && scripts[build] === undefined)
      problems.push(`${where}pragma.build "${build}" is not a script in package.json`)
  }
  check(mod.manifest.build, mod.scripts, '')
  for (const sub of mod.subPackages) check(sub.manifest.build, sub.scripts, `${relative(mod.dir, sub.dir)}: `)
}

/** Inspects one package folder; returns the module and the problems found (prefixed by the caller). */
export function inspectModuleDir(dir: string): Inspection {
  const problems: string[] = []
  if (!existsSync(join(dir, PACKAGE_JSON))) return { problems: [`missing ${PACKAGE_JSON}`] }
  const pkg = readPackage(dir)
  const parsed = ModuleManifestSchema.safeParse(pkg.pragma)
  if (!parsed.success) return { problems: [`missing or invalid pragma manifest: ${parsed.error.message}`] }
  const manifest = parsed.data
  checkIdentity(dir, manifest, pkg, problems)
  const isProvider = manifest.kind === PROVIDER_KIND
  const module: DiscoveredModule = {
    id: manifest.id,
    dir,
    packageName: pkg.name ?? '',
    version: pkg.version ?? '0.0.0',
    manifest,
    scripts: pkg.scripts ?? {},
    ...entryFiles(dir, pkg, problems),
    migrations: migrationFiles(dir, problems),
    locales: localeFiles(dir, isProvider, problems),
    testHooks: optionalFile(dir, TEST_HOOKS_FILE),
    subPackages: subPackages(dir, problems),
    provider: isProvider ? providerFiles(dir, problems) : undefined,
  }
  if (module.migrations.length > 0 && !module.mainEntry) problems.push('has migrations but no ./main export')
  checkBuildScripts(module, problems)
  return { module, problems }
}

/** Discovers one package folder; throws a GenerateError listing its problems. */
export function discoverModuleDir(dir: string): DiscoveredModule {
  const { module, problems } = inspectModuleDir(resolve(dir))
  if (!module || problems.length > 0) throw new GenerateError(problems.map((p) => `${dir}: ${p}`))
  return module
}

export function moduleRoots(repoRoot: string, roots?: readonly string[]): string[] {
  const extra = (process.env[EXTRA_ROOTS_ENV] ?? '').split(delimiter).filter(Boolean)
  return [...(roots ?? DEFAULT_MODULE_ROOTS), ...(roots ? [] : extra)].map((r) =>
    isAbsolute(r) ? r : resolve(repoRoot, r),
  )
}

function migrationProblems(mods: readonly DiscoveredModule[]): string[] {
  return checkMigrationDeps(
    mods.map((m) => ({
      id: m.id,
      dependsOn: m.manifest.dependsOn,
      migrations: m.migrations.map((file) => ({ file: basename(file), sql: readFileSync(file, UTF8) })),
    })),
  )
}

export interface DiscoverResult {
  modules: DiscoveredModule[]
  warnings: string[]
}

function scanRoots(opts: { repoRoot: string; roots?: readonly string[]; includeUnderscored?: boolean }) {
  const problems: string[] = []
  const modules: DiscoveredModule[] = []
  const dirs = moduleRoots(opts.repoRoot, opts.roots).flatMap((root) =>
    listDir(root)
      .filter((name) => !skipFolder(name, opts.includeUnderscored ?? false))
      .map((name) => join(root, name))
      .filter((dir) => existsSync(join(dir, PACKAGE_JSON))),
  )
  for (const dir of dirs) {
    const found = inspectModuleDir(dir)
    const rel = relative(opts.repoRoot, dir)
    problems.push(...found.problems.map((p) => `${rel}: ${p}`))
    if (found.module) modules.push(found.module)
  }
  return { modules, problems }
}

function duplicateIds(modules: readonly DiscoveredModule[]): string[] {
  const seen = new Set<string>()
  const problems: string[] = []
  for (const m of modules) {
    if (seen.has(m.id)) problems.push(`duplicate module id "${m.id}"`)
    seen.add(m.id)
  }
  return problems
}

/** Scans module and provider roots, validates every manifest and reports all problems at once. */
export function discoverModulesWithWarnings(opts: {
  repoRoot: string
  roots?: readonly string[]
  includeUnderscored?: boolean
}): DiscoverResult {
  const { modules, problems } = scanRoots(opts)
  problems.push(...duplicateIds(modules), ...migrationProblems(modules))
  if (problems.length > 0) throw new GenerateError(problems)
  const ids = new Set(modules.map((m) => m.id))
  const warnings = modules.flatMap((m) =>
    m.manifest.dependsOn.filter((d) => !ids.has(d)).map((d) => `${m.id} depends on unknown module "${d}"`),
  )
  return { modules: modules.sort((a, b) => a.id.localeCompare(b.id)), warnings }
}

export const discoverModules = (opts: Parameters<typeof discoverModulesWithWarnings>[0]): DiscoveredModule[] =>
  discoverModulesWithWarnings(opts).modules
