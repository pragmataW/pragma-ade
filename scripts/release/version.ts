import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BUMP_EXCLUDED_SEGMENTS,
  BUMP_KINDS,
  GIT,
  GIT_LS_FILES,
  LOCK_VERSION_FIELDS,
  NUL,
  PACKAGE_JSON,
  PACKAGE_LOCKS,
  README,
  readmeVersion,
  SEMVER,
  UTF8,
  versionField,
} from './constants.ts'

export type BumpKind = (typeof BUMP_KINDS)[number]

const isBumpKind = (s: string): s is BumpKind => (BUMP_KINDS as readonly string[]).includes(s)

export function parseVersion(v: string): [number, number, number] {
  const g = SEMVER.exec(v)?.groups
  if (!g) throw new Error(`not a X.Y.Z version: ${v}`)
  return [Number(g.major), Number(g.minor), Number(g.patch)]
}

const compare = (a: string, b: string): number => {
  const [aMajor, aMinor, aPatch] = parseVersion(a)
  const [bMajor, bMinor, bPatch] = parseVersion(b)
  return aMajor - bMajor || aMinor - bMinor || aPatch - bPatch
}

/** `spec` is an explicit X.Y.Z (must be greater than `current`) or a bump kind. */
export function nextVersion(current: string, spec: string): string {
  const [major, minor, patch] = parseVersion(current)
  if (!isBumpKind(spec)) {
    if (compare(spec, current) <= 0) throw new Error(`${spec} is not greater than the current version ${current}`)
    return spec
  }
  const next: Record<BumpKind, string> = {
    major: `${major + 1}.0.0`,
    minor: `${major}.${minor + 1}.0`,
    patch: `${major}.${minor}.${patch + 1}`,
  }
  return next[spec]
}

const readJson = (file: string): { version?: unknown } => JSON.parse(readFileSync(file, UTF8)) as { version?: unknown }

export function currentVersion(root: string): string {
  const v = readJson(join(root, PACKAGE_JSON)).version
  if (typeof v !== 'string') throw new Error(`${PACKAGE_JSON} has no version`)
  return v
}

/** Tracked package.json files (repo-relative) that carry `version`. */
export function versionedPackages(root: string, version: string): string[] {
  const out = execFileSync(GIT, [...GIT_LS_FILES], { cwd: root, encoding: UTF8 })
  return out
    .split(NUL)
    .filter((f) => f.length > 0 && !BUMP_EXCLUDED_SEGMENTS.some((seg) => `/${f}`.includes(seg)))
    .filter((f) => existsSync(join(root, f)) && readJson(join(root, f)).version === version)
}

/** Replaces the first `count` `"version": "from"` fields (a package.json has one, a lockfile two). */
export function replaceVersionFields(text: string, from: string, to: string, count = 1): string {
  let out = text
  for (let i = 0; i < count; i++) {
    if (!versionField(from).test(out)) throw new Error(`expected ${count} "version": "${from}" field(s)`)
    out = out.replace(versionField(from), `$1${to}$2`)
  }
  return out
}

export function rewriteReadme(text: string, from: string, to: string): string {
  return text.replace(readmeVersion(from), `$1${to}`)
}

function rewrite(file: string, fn: (text: string) => string): boolean {
  const before = readFileSync(file, UTF8)
  const after = fn(before)
  if (after !== before) writeFileSync(file, after)
  return after !== before
}

/** Bumps every place the release version lives; returns the changed files (repo-relative). */
export function bumpRepo(root: string, from: string, to: string): string[] {
  const changed: string[] = []
  const apply = (rel: string, fn: (text: string) => string): void => {
    if (rewrite(join(root, rel), fn)) changed.push(rel)
  }
  for (const rel of versionedPackages(root, from)) apply(rel, (t) => replaceVersionFields(t, from, to))
  for (const rel of PACKAGE_LOCKS) {
    if (existsSync(join(root, rel)) && readJson(join(root, rel)).version === from) {
      apply(rel, (t) => replaceVersionFields(t, from, to, LOCK_VERSION_FIELDS))
    }
  }
  if (existsSync(join(root, README))) apply(README, (t) => rewriteReadme(t, from, to))
  return changed
}
