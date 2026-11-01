import {
  baseLaunchSpec,
  initialPromptOf,
  type LaunchCapability,
  type LaunchContext,
  resolvePromptText,
} from '../../src/contract'
import type { ProviderAccess } from '../../src/main/profiles/profiles-store'

export interface FakeProviderDef {
  id: string
  command: string
  seed?: number
  /** Registered without a `launch` capability. */
  noLaunch?: boolean
  checkCompatibility?: LaunchCapability['checkCompatibility']
}

export const DEFAULT_PROVIDERS: FakeProviderDef[] = [
  { id: 'claude', command: 'claude', seed: 10 },
  { id: 'opencode', command: 'opencode', seed: 20 },
  { id: 'custom', command: '' },
]

/** Profile command + args, then the prompt as the final argument (long prompts via the temp file). */
async function buildFakeLaunch(ctx: LaunchContext) {
  const prompt = initialPromptOf(ctx)
  const resolved = prompt === undefined ? undefined : await resolvePromptText(ctx, prompt)
  const spec = baseLaunchSpec(ctx)
  return resolved ? { ...spec, args: spec.args.concat(resolved.text), tempFiles: resolved.tempFiles } : spec
}

/** A fake `ctx.providers` over descriptors with `launch` capabilities (`buildFakeLaunch`). */
export function makeProviders(
  defs: FakeProviderDef[] = DEFAULT_PROVIDERS,
): ProviderAccess & { defs: FakeProviderDef[] } {
  const descriptor = (d: FakeProviderDef) => ({
    id: d.id,
    displayNameKey: `${d.id}:provider.name`,
    icon: d.id,
    defaultCommand: d.command,
    defaultArgs: [],
  })
  const caps = new Map<string, LaunchCapability>(
    defs
      .filter((d) => !d.noLaunch)
      .map((d) => [
        d.id,
        {
          buildLaunch: buildFakeLaunch,
          ...(d.seed === undefined ? {} : { seed: { order: d.seed } }),
          ...(d.checkCompatibility ? { checkCompatibility: d.checkCompatibility } : {}),
        },
      ]),
  )
  return {
    defs,
    list: () => defs.map(descriptor),
    get: (id) => {
      const d = defs.find((x) => x.id === id)
      return d ? descriptor(d) : undefined
    },
    capability: ((id: string) => caps.get(id)) as ProviderAccess['capability'],
  }
}

let seq = 0
/** Deterministic ids and a clock for stores. */
export function storeDeps() {
  let clock = 1000
  return { now: () => ++clock, newId: () => `id-${++seq}` }
}
