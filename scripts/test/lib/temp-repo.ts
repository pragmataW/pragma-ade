import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll } from 'vitest'
import type { Runner } from '../../lib/builds.ts'

export type FileMap = Record<string, string | object>

const created: string[] = []
afterAll(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
})

export interface TempRepo {
  root: string
  write(files: FileMap): void
  path(rel: string): string
}

/** A throwaway repo root; removed after the test file. */
export function createTempRepo(files: FileMap = {}): TempRepo {
  const root = mkdtempSync(join(tmpdir(), 'pragma-gen-'))
  created.push(root)
  const write = (map: FileMap): void => {
    for (const [rel, content] of Object.entries(map)) {
      const file = join(root, rel)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`)
    }
  }
  write(files)
  return { root, write, path: (rel) => join(root, rel) }
}

type Pragma = Record<string, unknown>

/** A valid feature module folder under `modules/<id>` (or another root). */
export function featureModule(
  id: string,
  opts: { pragma?: Pragma; pkg?: Pragma; files?: FileMap; root?: string } = {},
) {
  const base = `${opts.root ?? 'modules'}/${id}`
  const files: FileMap = {
    [`${base}/package.json`]: {
      name: `@pragma/module-${id}`,
      version: '1.0.0',
      exports: { './main': './src/main/index.ts' },
      pragma: { id, kind: 'feature', displayNameKey: `${id}:module.name`, ...opts.pragma },
      ...opts.pkg,
    },
    [`${base}/src/main/index.ts`]: 'export default { activate() {} }\n',
    [`${base}/locales/en.json`]: { module: { name: id } },
  }
  for (const [rel, content] of Object.entries(opts.files ?? {})) files[`${base}/${rel}`] = content
  return files
}

/** A valid provider folder under `providers/<id>`. */
export function providerModule(id: string, opts: { files?: FileMap; root?: string } = {}) {
  const base = `${opts.root ?? 'providers'}/${id}`
  const files: FileMap = {
    [`${base}/package.json`]: {
      name: `@pragma/provider-${id}`,
      version: '1.0.0',
      exports: {},
      pragma: { id, kind: 'provider', displayNameKey: `${id}:module.name` },
    },
    [`${base}/src/main/provider.ts`]: 'export default {}\n',
    [`${base}/locales/en/provider.json`]: { module: { name: id }, provider: { name: id } },
  }
  for (const [rel, content] of Object.entries(opts.files ?? {})) files[`${base}/${rel}`] = content
  return files
}

/** Runs builds without inheriting stdio (keeps test output clean). */
export const quietRunner: Runner = (cmd, args, opts) => spawnSync(cmd, args, { cwd: opts.cwd, stdio: 'pipe' })
