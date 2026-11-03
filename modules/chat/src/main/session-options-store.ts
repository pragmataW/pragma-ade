import { z } from '@pragma/sdk'
import { readJsonFile, writeFileAtomic } from '@pragma/sdk/main'
import { SESSION_OPTIONS_MAX } from '../constants'
import {
  type ChatOptionDescriptor,
  chatOptionDescriptorSchema,
  chatOptionValueSchema,
  validateOptionValue,
} from '../contract'

const savedOptionsSchema = z.object({
  /** The last `options` the session described (the toolbar of a dormant session). */
  options: z.array(chatOptionDescriptorSchema),
  /** Values the user chose, kept current by later `options` events; `initialOptions` on resume. */
  chosen: z.record(z.string(), chatOptionValueSchema),
})
export type SavedSessionOptions = z.infer<typeof savedOptionsSchema>
const sessionsSchema = z.record(z.string(), savedOptionsSchema)
const storeSchema = z.object({
  sessions: sessionsSchema,
  /** The last `options` any session of a profile described, by profile id (dormant sessions with no entry). */
  latest: z.record(z.string(), z.array(chatOptionDescriptorSchema)),
})
type StoreFile = z.infer<typeof storeSchema>
/** The current shape, or the earlier one (session entries only). */
const fileSchema = z.union([storeSchema, sessionsSchema.transform((sessions): StoreFile => ({ sessions, latest: {} }))])

/**
 * The toolbar of a dormant session with no saved options: the profile's last-known options (the full choice lists,
 * e.g. every model) showing the values a fresh start would use — the provider's static default when it has one for
 * that key, else the descriptor's `default` — plus static defaults the last-known options lack.
 */
export function fallbackOptions(
  latest: readonly ChatOptionDescriptor[] | undefined,
  defaults: readonly ChatOptionDescriptor[] = [],
): ChatOptionDescriptor[] {
  const byKey = new Map(defaults.map((d) => [d.key, d]))
  const known = (latest ?? []).map((d) => {
    const s = byKey.get(d.key)
    if (!s) return { ...d, current: d.default }
    return validateOptionValue(d, s.current) ? { ...d, current: s.current } : s
  })
  const keys = new Set(known.map((d) => d.key))
  return [...known, ...defaults.filter((d) => !keys.has(d.key))]
}

/**
 * Session options that outlive the chat process and the app: a JSON file (in memory when `file` is omitted). A
 * missing or broken file starts empty; a failed write keeps the in-memory state.
 */
export class SessionOptionsStore {
  readonly #file: string | undefined
  readonly #onError: (e: unknown) => void
  #state: StoreFile | null = null

  constructor(file?: string, onError: (e: unknown) => void = () => undefined) {
    this.#file = file
    this.#onError = onError
  }

  #all(): StoreFile {
    if (this.#state) return this.#state
    const read = this.#file ? readJsonFile(this.#file, fileSchema) : null
    this.#state = read?.ok ? read.value : { sessions: {}, latest: {} }
    return this.#state
  }

  get(sessionId: string): SavedSessionOptions | undefined {
    return this.#all().sessions[sessionId]
  }

  set(sessionId: string, value: SavedSessionOptions): void {
    const { [sessionId]: _old, ...rest } = this.#all().sessions
    const keys = Object.keys(rest)
    const kept = keys.slice(Math.max(0, keys.length - SESSION_OPTIONS_MAX + 1))
    const sessions = { ...Object.fromEntries(kept.map((k) => [k, rest[k] as SavedSessionOptions])), [sessionId]: value }
    this.#write({ ...this.#all(), sessions })
  }

  latest(profileId: string): ChatOptionDescriptor[] | undefined {
    return this.#all().latest[profileId]
  }

  setLatest(profileId: string, options: ChatOptionDescriptor[]): void {
    const all = this.#all()
    this.#write({ ...all, latest: { ...all.latest, [profileId]: options } })
  }

  #write(state: StoreFile): void {
    this.#state = state
    if (!this.#file) return
    try {
      writeFileAtomic(this.#file, JSON.stringify(state))
    } catch (e) {
      this.#onError(e)
    }
  }
}
