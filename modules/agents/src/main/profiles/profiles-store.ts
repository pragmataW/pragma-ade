import { randomUUID } from 'node:crypto'
import { asc, eq, type PragmaDb } from '@pragma/sdk/db'
import type { MainContext } from '@pragma/sdk/main'
import { LAUNCH_CAPABILITY, SORT_ORDER_STEP } from '../../constants'
import {
  AGENTS_ERROR,
  type AgentProfile,
  AgentsError,
  BUILTIN_PROFILE_PREFIX,
  type CreateProfileInput,
  createProfileInputSchema,
  envSchema,
  formatArgs,
  type ProfileEnv,
  type ProviderInfo,
  tryParseArgs,
  type UpdateProfilePatch,
  updateProfilePatchSchema,
} from '../../contract'
import { type ProfileRow, agentsProfiles as T } from '../schema'

export type ProviderAccess = Pick<MainContext['providers'], 'list' | 'get' | 'capability'>
export interface StoreDeps {
  now?: () => number
  newId?: () => string
}
type RowPatch = Partial<Omit<ProfileRow, 'id' | 'createdAt'>>

const isEmpty = (s: string | null | undefined): boolean => s === null || s === undefined || s.trim() === ''

function parseArgsOrThrow(value: string): string[] {
  const parsed = tryParseArgs(value)
  if (!parsed.ok) throw new AgentsError(AGENTS_ERROR.argsInvalid, { index: String(parsed.index) })
  return parsed.args
}

function parseEnvOrThrow(env: unknown): ProfileEnv {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) throw new AgentsError(AGENTS_ERROR.envInvalid)
  return parsed.data
}

const readEnv = (json: string): ProfileEnv => {
  const parsed = envSchema.safeParse(JSON.parse(json))
  return parsed.success ? parsed.data : {}
}

/** Agent profiles (`agents_profiles`): built-ins seeded from `launch` capabilities, overrides, default rules. */
export class ProfilesStore {
  readonly #db: PragmaDb
  readonly #providers: ProviderAccess
  readonly #now: () => number
  readonly #newId: () => string

  constructor(db: PragmaDb, providers: ProviderAccess, deps: StoreDeps = {}) {
    this.#db = db
    this.#providers = providers
    this.#now = deps.now ?? Date.now
    this.#newId = deps.newId ?? randomUUID
  }

  #launch(providerId: string) {
    return this.#providers.get(providerId) ? this.#providers.capability(providerId, LAUNCH_CAPABILITY) : undefined
  }

  #rows(): ProfileRow[] {
    return this.#db.select().from(T).orderBy(asc(T.sortOrder)).all()
  }

  #row(id: string): ProfileRow {
    const row = this.#db.select().from(T).where(eq(T.id, id)).get()
    if (!row) throw new AgentsError(AGENTS_ERROR.profileNotFound, { id })
    return row
  }

  #write(id: string, patch: RowPatch): void {
    this.#db
      .update(T)
      .set({ ...patch, updatedAt: this.#now() })
      .where(eq(T.id, id))
      .run()
  }

  #toProfile(row: ProfileRow): AgentProfile {
    const provider = this.#providers.get(row.providerId)
    const available = this.#launch(row.providerId) !== undefined
    const stockCommand = row.isBuiltin ? (provider?.defaultCommand ?? null) : null
    const stockArgs = row.isBuiltin ? (provider?.defaultArgs ?? []) : null
    const parsedArgs = row.args === null ? null : tryParseArgs(row.args)
    return {
      id: row.id,
      providerId: row.providerId,
      name: row.name,
      displayNameKey: available ? (provider?.displayNameKey ?? null) : null,
      commandOverride: row.command,
      argsOverride: row.args,
      command: row.command ?? stockCommand ?? '',
      args: parsedArgs?.ok ? parsedArgs.args : (stockArgs ?? []),
      stockCommand,
      stockArgs,
      env: readEnv(row.envJson),
      enabled: row.enabled,
      isDefault: row.isDefault,
      isBuiltin: row.isBuiltin,
      sortOrder: row.sortOrder,
      available,
    }
  }

  /** Inserts a built-in row for every seeded provider that has none, then makes sure one profile is the default. */
  ensureBuiltinProfiles(): void {
    this.#db.transaction(() => {
      const builtins = new Set(
        this.#rows()
          .filter((r) => r.isBuiltin)
          .map((r) => r.providerId),
      )
      for (const d of this.#providers.list()) {
        const seed = this.#launch(d.id)?.seed
        if (!seed || builtins.has(d.id)) continue
        const now = this.#now()
        this.#db
          .insert(T)
          .values({
            id: `${BUILTIN_PROFILE_PREFIX}${d.id}`,
            providerId: d.id,
            isBuiltin: true,
            sortOrder: seed.order,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      }
      this.#ensureDefault()
    })
  }

  /** No default → the lowest-order enabled, available profile becomes it. */
  #ensureDefault(): void {
    const profiles = this.#rows().map((r) => this.#toProfile(r))
    if (profiles.some((p) => p.isDefault)) return
    const next = profiles.find((p) => p.enabled && p.available)
    if (next) this.#write(next.id, { isDefault: true })
  }

  list(opts: { launchableOnly?: boolean } = {}): AgentProfile[] {
    const all = this.#rows().map((r) => this.#toProfile(r))
    if (!opts.launchableOnly) return all
    const launchable = all.filter((p) => p.enabled && p.available)
    return [...launchable.filter((p) => p.isDefault), ...launchable.filter((p) => !p.isDefault)]
  }

  get(id: string): AgentProfile | null {
    const row = this.#db.select().from(T).where(eq(T.id, id)).get()
    return row ? this.#toProfile(row) : null
  }

  getDefault(): AgentProfile | null {
    const row = this.#db.select().from(T).where(eq(T.isDefault, true)).get()
    return row ? this.#toProfile(row) : null
  }

  create(input: CreateProfileInput): AgentProfile {
    const env = parseEnvOrThrow(input.env ?? {})
    const parsed = createProfileInputSchema.parse({ ...input, env })
    parseArgsOrThrow(parsed.args)
    if (!this.#launch(parsed.providerId))
      throw new AgentsError(AGENTS_ERROR.providerUnavailable, { providerId: parsed.providerId })
    const id = this.#newId()
    const now = this.#now()
    const last = this.#rows().at(-1)?.sortOrder ?? 0
    this.#db
      .insert(T)
      .values({
        id,
        providerId: parsed.providerId,
        name: parsed.name,
        command: parsed.command,
        args: parsed.args,
        envJson: JSON.stringify(env),
        sortOrder: last + SORT_ORDER_STEP,
        createdAt: now,
        updatedAt: now,
      })
      .run()
    return this.#toProfile(this.#row(id))
  }

  update(id: string, input: UpdateProfilePatch): AgentProfile {
    const current = this.#toProfile(this.#row(id))
    const patch = updateProfilePatchSchema.parse({ ...input, env: undefined })
    const row: RowPatch = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.command !== undefined) row.command = this.#commandValue(current, patch.command)
    if (patch.args !== undefined) row.args = this.#argsValue(current, patch.args)
    if (input.env !== undefined) row.envJson = JSON.stringify(parseEnvOrThrow(input.env))
    if (patch.enabled !== undefined) {
      if (!patch.enabled && current.isDefault) throw new AgentsError(AGENTS_ERROR.cannotDisableDefault)
      row.enabled = patch.enabled
    }
    this.#write(id, row)
    return this.#toProfile(this.#row(id))
  }

  /** Built-ins: empty or stock → NULL (not customized). Customs need a command. */
  #commandValue(p: AgentProfile, command: string | null): string | null {
    const value = command?.trim() ?? ''
    if (p.isBuiltin) return isEmpty(value) || value === p.stockCommand ? null : value
    return createProfileInputSchema.shape.command.parse(value)
  }

  /** Built-ins: the stock arguments → NULL. Unparsable → `argsInvalid` (row unchanged). */
  #argsValue(p: AgentProfile, args: string | null): string | null {
    if (args === null) return p.isBuiltin ? null : ''
    const parsed = parseArgsOrThrow(args)
    if (p.isBuiltin && formatArgs(parsed) === formatArgs(p.stockArgs ?? [])) return null
    return args
  }

  /** Clears command/args overrides of a built-in; env is kept. */
  reset(id: string): AgentProfile {
    if (!this.#row(id).isBuiltin) throw new AgentsError(AGENTS_ERROR.cannotResetCustom)
    this.#write(id, { command: null, args: null })
    return this.#toProfile(this.#row(id))
  }

  setDefault(id: string): void {
    const p = this.#toProfile(this.#row(id))
    if (!p.enabled) throw new AgentsError(AGENTS_ERROR.cannotDefaultDisabled)
    if (!p.available) throw new AgentsError(AGENTS_ERROR.providerUnavailable, { providerId: p.providerId })
    this.#db.transaction(() => {
      this.#db.update(T).set({ isDefault: false }).where(eq(T.isDefault, true)).run()
      this.#write(id, { isDefault: true })
    })
  }

  remove(id: string): void {
    if (this.#row(id).isBuiltin) throw new AgentsError(AGENTS_ERROR.cannotDeleteBuiltin)
    this.#db.transaction(() => {
      this.#db.delete(T).where(eq(T.id, id)).run()
      this.#ensureDefault()
    })
  }

  /** Providers with a `launch` capability (`seeded` = it creates a built-in profile). */
  listProviders(): ProviderInfo[] {
    return this.#providers.list().flatMap((d) => {
      const cap = this.#launch(d.id)
      return cap ? [{ ...d, seeded: cap.seed !== undefined }] : []
    })
  }
}
