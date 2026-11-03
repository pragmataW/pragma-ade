import { z } from '@pragma/sdk'
import { readJsonFile, writeFileAtomic } from '@pragma/sdk/main'
import { SESSION_OPTIONS_MAX } from '../constants'
import { chatOptionDescriptorSchema, chatOptionValueSchema } from '../contract'

const savedOptionsSchema = z.object({
  /** The last `options` the session described (the toolbar of a dormant session). */
  options: z.array(chatOptionDescriptorSchema),
  /** Values the user chose, kept current by later `options` events; `initialOptions` on resume. */
  chosen: z.record(z.string(), chatOptionValueSchema),
})
export type SavedSessionOptions = z.infer<typeof savedOptionsSchema>
const fileSchema = z.record(z.string(), savedOptionsSchema)

/**
 * Session options that outlive the chat process and the app: a JSON file (in memory when `file` is omitted). A
 * missing or broken file starts empty; a failed write keeps the in-memory state.
 */
export class SessionOptionsStore {
  readonly #file: string | undefined
  readonly #onError: (e: unknown) => void
  #entries: Record<string, SavedSessionOptions> | null = null

  constructor(file?: string, onError: (e: unknown) => void = () => undefined) {
    this.#file = file
    this.#onError = onError
  }

  #all(): Record<string, SavedSessionOptions> {
    if (this.#entries) return this.#entries
    const read = this.#file ? readJsonFile(this.#file, fileSchema) : null
    this.#entries = read?.ok ? read.value : {}
    return this.#entries
  }

  get(sessionId: string): SavedSessionOptions | undefined {
    return this.#all()[sessionId]
  }

  set(sessionId: string, value: SavedSessionOptions): void {
    const { [sessionId]: _old, ...rest } = this.#all()
    const keys = Object.keys(rest)
    const kept = keys.slice(Math.max(0, keys.length - SESSION_OPTIONS_MAX + 1))
    this.#entries = { ...Object.fromEntries(kept.map((k) => [k, rest[k] as SavedSessionOptions])), [sessionId]: value }
    if (!this.#file) return
    try {
      writeFileAtomic(this.#file, JSON.stringify(this.#entries))
    } catch (e) {
      this.#onError(e)
    }
  }
}
