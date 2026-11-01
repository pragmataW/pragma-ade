import type { Logger } from '../../common/logger'
import type {
  CapabilityContext,
  CapabilityKey,
  CapabilityMap,
  CapabilityRegistration,
  ProviderDescriptor,
  ProviderIconComponent,
  RendererCapabilityKey,
  RendererCapabilityMap,
  RendererCapabilityRegistration,
} from '../../common/providers'

export class ProviderMismatchError extends Error {}

type CreatedCapability = { dispose?(): void | Promise<void> }

/** Main-side `ctx.providers`. */
export interface ProvidersApi {
  list(): ProviderDescriptor[]
  get(id: string): ProviderDescriptor | undefined
  capability<K extends CapabilityKey>(id: string, key: K): CapabilityMap[K] | undefined
  /** Checks registration only; does not create capabilities. */
  providersWith<K extends CapabilityKey>(key: K): ProviderDescriptor[]
}

/** Renderer-side `ctx.providers`. */
export interface RendererProvidersApi {
  list(): ProviderDescriptor[]
  get(id: string): ProviderDescriptor | undefined
  icon(id: string): ProviderIconComponent | undefined
  rendererCapability<K extends RendererCapabilityKey>(id: string, key: K): RendererCapabilityMap[K] | undefined
  providersWithRenderer<K extends RendererCapabilityKey>(key: K): ProviderDescriptor[]
}

const byId = (a: ProviderDescriptor, b: ProviderDescriptor): number => a.id.localeCompare(b.id)

function assertDescriptor(moduleId: string, descriptor: ProviderDescriptor): void {
  if (descriptor.id !== moduleId)
    throw new ProviderMismatchError(`provider descriptor id "${descriptor.id}" must equal module id "${moduleId}"`)
}

function ownCapabilities<T extends { providerId: string; key: string }>(moduleId: string, caps: T[], log: Logger) {
  const own = new Map<string, T>()
  for (const cap of caps) {
    if (cap.providerId === moduleId) own.set(cap.key, cap)
    else log.warn(`provider ${moduleId}: skipped capability ${cap.key} declared for "${cap.providerId}"`)
  }
  return own
}

interface BaseEntry {
  descriptor: ProviderDescriptor
  caps: Map<string, unknown>
}

/** `list`, `get` and `withKey` shared by the main and renderer APIs. */
function descriptorQueries(entries: Map<string, BaseEntry>) {
  const list = (): ProviderDescriptor[] => [...entries.values()].map((e) => e.descriptor).sort(byId)
  return {
    list,
    get: (id: string) => entries.get(id)?.descriptor,
    withKey: (key: string) => list().filter((d) => entries.get(d.id)?.caps.has(key)),
  }
}

interface MainEntry {
  descriptor: ProviderDescriptor
  caps: Map<string, CapabilityRegistration>
  created: Map<string, CreatedCapability>
}

export class ProviderRegistry {
  readonly #entries = new Map<string, MainEntry>()
  readonly #makeCapCtx: (providerId: string) => CapabilityContext
  readonly #log: Logger

  constructor(makeCapCtx: (providerId: string) => CapabilityContext, log: Logger) {
    this.#makeCapCtx = makeCapCtx
    this.#log = log
  }

  add(moduleId: string, descriptor: ProviderDescriptor, caps: CapabilityRegistration[]): void {
    assertDescriptor(moduleId, descriptor)
    this.#entries.set(moduleId, { descriptor, caps: ownCapabilities(moduleId, caps, this.#log), created: new Map() })
  }

  capability(id: string, key: string): CreatedCapability | undefined {
    const entry = this.#entries.get(id)
    const reg = entry?.caps.get(key)
    if (!entry || !reg) return undefined
    const existing = entry.created.get(key)
    if (existing) return existing
    const impl = reg.create(this.#makeCapCtx(id))
    entry.created.set(key, impl)
    return impl
  }

  async disposeAll(): Promise<void> {
    for (const [id, entry] of this.#entries) {
      for (const [key, impl] of entry.created) {
        try {
          await impl.dispose?.()
        } catch (error) {
          this.#log.error(`provider ${id}: dispose of ${key} failed`, error)
        }
      }
      entry.created.clear()
    }
  }

  api(): ProvidersApi {
    const q = descriptorQueries(this.#entries)
    return {
      list: q.list,
      get: q.get,
      capability: <K extends CapabilityKey>(id: string, key: K) =>
        this.capability(id, key) as CapabilityMap[K] | undefined,
      providersWith: q.withKey,
    }
  }
}

interface RendererEntry {
  descriptor: ProviderDescriptor
  icon?: ProviderIconComponent
  caps: Map<string, RendererCapabilityRegistration>
}

export class RendererProviderRegistry {
  readonly #entries = new Map<string, RendererEntry>()
  readonly #log: Logger

  constructor(log: Logger) {
    this.#log = log
  }

  add(
    moduleId: string,
    descriptor: ProviderDescriptor,
    icon: ProviderIconComponent | undefined,
    caps: RendererCapabilityRegistration[],
  ): void {
    assertDescriptor(moduleId, descriptor)
    this.#entries.set(moduleId, { descriptor, icon, caps: ownCapabilities(moduleId, caps, this.#log) })
  }

  api(): RendererProvidersApi {
    const q = descriptorQueries(this.#entries)
    return {
      list: q.list,
      get: q.get,
      icon: (id) => this.#entries.get(id)?.icon,
      rendererCapability: <K extends RendererCapabilityKey>(id: string, key: K) =>
        this.#entries.get(id)?.caps.get(key)?.impl as RendererCapabilityMap[K] | undefined,
      providersWithRenderer: q.withKey,
    }
  }
}
