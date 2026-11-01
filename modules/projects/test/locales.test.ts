import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../locales/en.json'
import { PROJECTS_COMMANDS, PROJECTS_ERROR_CODES } from '../src/contract'

const RENDERER_DIR = join(import.meta.dirname, '..', 'src', 'renderer')
const KEY_RE = /\bt\(\s*'projects:([A-Za-z0-9_.]+)'/g
const PLURAL = /_(one|other)$/

function flatKeys(tree: unknown, prefix = ''): string[] {
  if (typeof tree !== 'object' || tree === null) return [prefix, prefix.replace(PLURAL, '')]
  return Object.entries(tree).flatMap(([k, v]) => flatKeys(v, prefix ? `${prefix}.${k}` : k))
}
const keys = new Set(flatKeys(en))

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('projects locale', () => {
  it.each(PROJECTS_ERROR_CODES)('has errors.%s', (code) => expect(keys.has(`errors.${code}`)).toBe(true))

  it.each(Object.keys(PROJECTS_COMMANDS))('has commands.%s', (name) => expect(keys.has(`commands.${name}`)).toBe(true))

  it('every t() key used in the renderer exists', () => {
    const used = tsxFiles(RENDERER_DIR).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(KEY_RE)].map((m) => m[1]))
    expect(used.filter((k) => !keys.has(k ?? ''))).toEqual([])
  })
})
