import { createHash } from 'node:crypto'
import { cpSync, createReadStream, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, posix } from 'node:path'
import type { z } from 'zod'
import {
  CACHE_DIR_NAME,
  CACHE_ENV,
  GLOB_STAR,
  HIDDEN_DIR_PREFIX,
  NODE_MODULES,
  POSIX_SEP,
  STREAM_EVENT,
  TEMP_LABEL_SEPARATOR,
  UTF8,
} from '../constants.ts'

const SHA256 = 'sha256'
const HEX = 'hex'

/** Every regular file (and symlink) below `root`, depth first; `skipDirs` names are not entered. */
export function walkFiles(root: string, opts: { skipDirs?: readonly string[] } = {}): string[] {
  const out: string[] = []
  const skip = new Set(opts.skipDirs ?? [])
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) visit(path)
      } else out.push(path)
    }
  }
  visit(root)
  return out
}

export const readJson = <T>(path: string, schema: z.ZodType<T>): T => schema.parse(JSON.parse(readFileSync(path, UTF8)))

/** Recursive copy that keeps file modes and symlinks (`.app` bundles are full of framework symlinks). */
export function copyDir(src: string, dest: string): void {
  cpSync(src, dest, { recursive: true, verbatimSymlinks: true, preserveTimestamps: true })
}

/** A fresh temp dir whose name always contains a space (paths with spaces are a review focus). */
export const mkTemp = (label: string): string => mkdtempSync(join(tmpdir(), `${label}${TEMP_LABEL_SEPARATOR}`))

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash(SHA256)
    createReadStream(path)
      .on(STREAM_EVENT.data, (c) => hash.update(c))
      .on(STREAM_EVENT.error, reject)
      .on(STREAM_EVENT.end, () => resolve(hash.digest(HEX)))
  })
}

export const cacheRoot = (env: NodeJS.ProcessEnv = process.env): string =>
  env[CACHE_ENV] || join(homedir(), CACHE_DIR_NAME)

export const isDir = (path: string): boolean => {
  try {
    return lstatSync(path).isDirectory()
  } catch {
    return false
  }
}

const childNames = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => !e.name.startsWith(HIDDEN_DIR_PREFIX) && e.name !== NODE_MODULES)
        .map((e) => e.name)
    : []

/** Existing paths (relative, `/`-separated) matching a pattern of literal and `*` segments. */
export function expandStars(root: string, pattern: string): string[] {
  let paths = ['']
  for (const segment of pattern.split(POSIX_SEP).filter(Boolean)) {
    paths = paths.flatMap((d) =>
      segment === GLOB_STAR ? childNames(join(root, d)).map((n) => posix.join(d, n)) : [posix.join(d, segment)],
    )
  }
  return paths.filter((p) => p !== '' && existsSync(join(root, p)))
}
