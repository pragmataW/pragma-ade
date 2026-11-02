import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path'
import {
  APP_ROOT,
  EXCLUDED_DIR_PREFIX,
  GLOB_GLOBSTAR,
  GLOB_NEGATION,
  GLOB_STAR,
  HIDDEN_DIR_PREFIX,
  NODE_MODULES,
  OWNER_ROOTS,
  PACKAGE_JSON,
  PARENT_SEGMENT,
  PNPM_WORKSPACE_FILE,
  POSIX_SEP,
  RESOURCE_MODULES_DIR,
  SUB_PACKAGES_DIR,
  UTF8,
  WIN_SEP,
} from '../constants.ts'
import { loadYaml } from './deps.ts'
import { readJson } from './fsx.ts'
import { type ExtraResource, type PackageJson, PackageJsonSchema, WorkspaceYamlSchema } from './schema.ts'

export const ROLE = { app: 'app', owner: 'owner', subPackage: 'sub-package', other: 'other' } as const
export const PACKAGE_ROLES = [ROLE.app, ROLE.owner, ROLE.subPackage, ROLE.other] as const
/** `modules/<id>` and `modules/<id>/packages/<sub>` path depths. */
const OWNER_DEPTH = 2
const SUB_PACKAGE_DEPTH = 4
export type PackageRole = (typeof PACKAGE_ROLES)[number]

export interface WorkspacePackage {
  name: string
  dir: string
  json: PackageJson
  ownerId: string | null
  role: PackageRole
}

export interface ResourceDecl {
  ownerId: string
  /** Directory of the package that declares the entry. */
  declaredBy: string
  fromAbs: string
  to: string
  /** `modules/<ownerId>/<to>` below the packaged `resources/` dir. */
  dest: string
}

export interface PackagingPlan {
  resources: ResourceDecl[]
  unpackagedBuilds: { ownerId: string; packageName: string }[]
}

export class ManifestError extends Error {}

const visibleDirs = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith(HIDDEN_DIR_PREFIX) && e.name !== NODE_MODULES)
        .map((e) => e.name)
    : []

/** Expands a `pnpm-workspace.yaml` pattern made of literal and `*` segments. */
function expandPattern(repoRoot: string, pattern: string): string[] {
  let dirs = ['']
  for (const segment of pattern.split(POSIX_SEP).filter(Boolean)) {
    dirs = dirs.flatMap((d) =>
      segment === GLOB_STAR ? visibleDirs(join(repoRoot, d)).map((n) => posix.join(d, n)) : [posix.join(d, segment)],
    )
  }
  return dirs.filter((d) => existsSync(join(repoRoot, d, PACKAGE_JSON)))
}

function roleOf(rel: string): { role: PackageRole; ownerDir: string | null } {
  const parts = rel.split(POSIX_SEP)
  const [root, , sub] = parts
  const other = { role: ROLE.other, ownerDir: null }
  if (root === APP_ROOT && parts.length === OWNER_DEPTH) return { role: ROLE.app, ownerDir: null }
  if (!(OWNER_ROOTS as readonly string[]).includes(root ?? '')) return other
  const ownerDir = parts.slice(0, OWNER_DEPTH).join(POSIX_SEP)
  if (parts.length === OWNER_DEPTH) return { role: ROLE.owner, ownerDir }
  if (sub === SUB_PACKAGES_DIR && parts.length === SUB_PACKAGE_DEPTH) return { role: ROLE.subPackage, ownerDir }
  return other
}

/** Packages matched by `pnpm-workspace.yaml`; `**` and `!` patterns are reported in `warnings` and skipped. */
export function listWorkspacePackages(repoRoot: string, warnings: string[] = []): WorkspacePackage[] {
  const yaml = WorkspaceYamlSchema.parse(loadYaml().parse(readFileSync(join(repoRoot, PNPM_WORKSPACE_FILE), UTF8)))
  const rels = new Set<string>()
  for (const pattern of yaml.packages) {
    if (pattern.includes(GLOB_GLOBSTAR) || pattern.startsWith(GLOB_NEGATION)) {
      warnings.push(`${PNPM_WORKSPACE_FILE}: pattern "${pattern}" is not supported by the packaging tool; skipped`)
      continue
    }
    for (const rel of expandPattern(repoRoot, pattern)) rels.add(rel)
  }
  const found = [...rels].sort().map((rel) => ({
    rel,
    dir: resolve(repoRoot, rel),
    json: readJson(join(repoRoot, rel, PACKAGE_JSON), PackageJsonSchema),
    ...roleOf(rel),
  }))
  const ownerIds = new Map(found.filter((p) => p.role === ROLE.owner).map((p) => [p.rel, p.json.pragma?.id ?? null]))
  return found.map(({ dir, json, role, ownerDir }) => ({
    name: json.name,
    dir,
    json,
    role,
    ownerId: ownerDir ? (ownerIds.get(ownerDir) ?? null) : null,
  }))
}

const folderName = (dir: string): string => dir.split(sep).at(-1) ?? ''

/** `pragma.id` of every module and provider whose folder does not start with `_`. */
export function includedOwnerIds(pkgs: readonly WorkspacePackage[]): Set<string> {
  return new Set(
    pkgs
      .filter((p) => p.role === ROLE.owner && p.ownerId && !folderName(p.dir).startsWith(EXCLUDED_DIR_PREFIX))
      .map((p) => p.ownerId as string),
  )
}

const hasParentSegment = (p: string): boolean => p.split(POSIX_SEP).includes(PARENT_SEGMENT)

function checkedTo(pkg: WorkspacePackage, entry: ExtraResource): string {
  const fail = (why: string): never => {
    throw new ManifestError(`${pkg.name}: extraResources ${entry.from} → ${entry.to}: ${why}`)
  }
  if (entry.to.includes(WIN_SEP)) fail('"to" must use / separators')
  if (posix.isAbsolute(entry.to) || isAbsolute(entry.to)) fail('"to" must be relative')
  if (hasParentSegment(entry.to)) fail('"to" must not contain ..')
  const to = posix.normalize(entry.to).replace(/\/+$/, '')
  if (to === '' || to === HIDDEN_DIR_PREFIX) fail('"to" is empty')
  const fromAbs = resolve(pkg.dir, entry.from)
  const fromRel = relative(pkg.dir, fromAbs)
  if (fromRel.startsWith(PARENT_SEGMENT) || isAbsolute(fromRel)) fail('"from" is outside the declaring package')
  if (fromRel.split(sep).includes(NODE_MODULES))
    fail('"from" must not point into node_modules (packaging installs npm dependencies per target)')
  return to
}

function declarationsOf(pkg: WorkspacePackage): ResourceDecl[] {
  const ownerId = pkg.ownerId as string
  return (pkg.json.pragma?.package?.extraResources ?? []).map((entry) => {
    const to = checkedTo(pkg, entry)
    return {
      ownerId,
      declaredBy: pkg.dir,
      fromAbs: resolve(pkg.dir, entry.from),
      to,
      dest: posix.join(RESOURCE_MODULES_DIR, ownerId, to),
    }
  })
}

/** Two entries of one owner may not land on the same path or inside each other. */
function assertNoOverlap(resources: readonly ResourceDecl[], nameOf: (dir: string) => string): void {
  for (const [i, a] of resources.entries()) {
    for (const b of resources.slice(i + 1)) {
      if (a.ownerId !== b.ownerId) continue
      const overlap = a.dest === b.dest || a.dest.startsWith(`${b.dest}/`) || b.dest.startsWith(`${a.dest}/`)
      if (overlap)
        throw new ManifestError(
          `${nameOf(b.declaredBy)}: extraResources destination ${b.dest} overlaps ${a.dest} (${nameOf(a.declaredBy)})`,
        )
    }
  }
}

/** Every `pragma.package.extraResources` of included owners and their sub-packages (§10.2, §10.4). */
export function collectPackaging(pkgs: readonly WorkspacePackage[]): PackagingPlan {
  const included = includedOwnerIds(pkgs)
  const members = pkgs.filter(
    (p) => (p.role === ROLE.owner || p.role === ROLE.subPackage) && p.ownerId !== null && included.has(p.ownerId),
  )
  const resources = members.flatMap(declarationsOf)
  const names = new Map(pkgs.map((p) => [p.dir, p.name]))
  assertNoOverlap(resources, (dir) => names.get(dir) ?? dir)
  const declaring = new Set(resources.map((r) => r.ownerId))
  const unpackagedBuilds = members
    .filter((p) => p.json.pragma?.build && !declaring.has(p.ownerId as string))
    .map((p) => ({ ownerId: p.ownerId as string, packageName: p.name }))
  return { resources, unpackagedBuilds }
}
