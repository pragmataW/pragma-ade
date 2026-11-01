import { existsSync, renameSync } from 'node:fs'
import { z } from 'zod'
import { isPlainObject, mergeUnknown } from '../../common/deep-merge'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { Logger } from '../../common/logger'
import type { SettingsSection } from '../../common/settings'
import { JSON_INDENT } from '../../constants'
import { READ_JSON_FAILURE, readJsonFile, writeFileAtomic } from '../../main/fs'

export class SettingsValidationError extends Error {}
export class UnknownSettingsSectionError extends Error {}

export const ALL_SECTIONS = '*'
type Listener = (value: unknown, section: string) => void

const RawSchema = z.record(z.string(), z.unknown())

/** Deep-sorts object keys so settings.json has a stable order. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (!isPlainObject(value)) return value
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((k) => [k, sortKeys(value[k])]),
  )
}

interface Registered {
  section: SettingsSection<unknown>
  value: unknown
}

/** settings.json with one zod-validated section per module (§4.6). Unknown sections are preserved. */
export class SettingsStore {
  readonly #file: string
  readonly #log: Logger
  readonly #raw: Record<string, unknown>
  readonly #sections = new Map<string, Registered>()
  readonly #listeners = new Map<string, Set<Listener>>()

  constructor(filePath: string, log: Logger) {
    this.#file = filePath
    this.#log = log
    this.#raw = this.#load()
  }

  #load(): Record<string, unknown> {
    const result = readJsonFile(this.#file, RawSchema)
    if (result.ok) return result.value
    if (result.reason === READ_JSON_FAILURE.missing) return {}
    const backup = `${this.#file}.corrupt-${Date.now()}`
    if (existsSync(this.#file)) renameSync(this.#file, backup)
    this.#log.warn(`settings file is corrupt (${result.reason}); backed up to ${backup}`)
    return {}
  }

  registerSection<T>(id: string, s: SettingsSection<T>): void {
    const section = s as SettingsSection<unknown>
    const parsed = section.schema.safeParse(mergeUnknown(section.defaults, this.#raw[id]))
    if (!parsed.success) this.#log.warn(`settings section "${id}" is invalid; using defaults`, parsed.error.message)
    this.#sections.set(id, { section, value: parsed.success ? parsed.data : section.defaults })
  }

  has(id: string): boolean {
    return this.#sections.has(id)
  }

  #entry(id: string): Registered {
    const entry = this.#sections.get(id)
    if (!entry) throw new UnknownSettingsSectionError(`unknown settings section "${id}"`)
    return entry
  }

  get<T>(id: string): T {
    return this.#entry(id).value as T
  }

  set<T>(id: string, v: T): T {
    const entry = this.#entry(id)
    const parsed = entry.section.schema.safeParse(v)
    if (!parsed.success) throw new SettingsValidationError(`invalid value for "${id}": ${parsed.error.message}`)
    entry.value = parsed.data
    this.#raw[id] = parsed.data
    this.#write()
    this.#emit(id, parsed.data)
    return parsed.data as T
  }

  update<T>(id: string, p: unknown): T {
    return this.set(id, mergeUnknown(this.#entry(id).value, p)) as T
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries([...this.#sections].map(([id, e]) => [id, e.value]))
  }

  onChange(id: string, cb: Listener): Disposable {
    const set = this.#listeners.get(id) ?? new Set()
    this.#listeners.set(id, set)
    set.add(cb)
    return toDisposable(() => set.delete(cb))
  }

  #emit(id: string, value: unknown): void {
    for (const key of [id, ALL_SECTIONS]) for (const cb of [...(this.#listeners.get(key) ?? [])]) cb(value, id)
  }

  #write(): void {
    writeFileAtomic(this.#file, `${JSON.stringify(sortKeys(this.#raw), null, JSON_INDENT)}\n`)
  }
}
