import { type Disposable, toDisposable } from '../../common/disposable'
import type { Logger } from '../../common/logger'
import {
  chordId,
  type KeyInput,
  matchesChord,
  parseAccelerator,
  RESERVED_EDITOR_CHORDS,
  type ShortcutSpec,
  ShortcutSpecSchema,
} from '../../common/shortcuts'
import { SHORTCUT_SCOPE } from '../../constants'

export class ReservedShortcutError extends Error {}
export class ShortcutConflictError extends Error {}

export type ShortcutFocus = 'app' | 'native-view'

export interface ShortcutRegistry {
  register(spec: ShortcutSpec): Disposable
  list(): ShortcutSpec[]
  /** `native-view` focus matches only `global` specs; `app` focus matches both scopes. */
  match(input: KeyInput, focus: ShortcutFocus): ShortcutSpec | undefined
  onChange(cb: () => void): Disposable
}

const NATIVE_VIEW_FOCUS: ShortcutFocus = 'native-view'

export function createShortcutRegistry(platform: string, log: Logger): ShortcutRegistry {
  const specs = new Map<string, ShortcutSpec>()
  const listeners = new Set<() => void>()
  const chordOf = (accelerator: string): string => chordId(parseAccelerator(accelerator, platform))
  const reserved = new Set(RESERVED_EDITOR_CHORDS.map(chordOf))
  const notify = (): void => {
    for (const cb of listeners) cb()
  }

  const assertRegistrable = (spec: ShortcutSpec): void => {
    const chord = chordOf(spec.accelerator)
    if (spec.scope === SHORTCUT_SCOPE.global && reserved.has(chord))
      throw new ReservedShortcutError(
        `${spec.accelerator} is a reserved editor chord and cannot be global (${spec.id})`,
      )
    if (specs.has(spec.id)) throw new ShortcutConflictError(`shortcut ${spec.id} is already registered`)
    // Both scopes are active while the app has focus, so any two specs with one chord overlap.
    const clash = [...specs.values()].find((s) => chordOf(s.accelerator) === chord)
    if (clash) throw new ShortcutConflictError(`${spec.accelerator} (${spec.id}) conflicts with ${clash.id}`)
  }

  return {
    register(input) {
      const spec = ShortcutSpecSchema.parse(input)
      assertRegistrable(spec)
      specs.set(spec.id, spec)
      log.debug(`shortcut ${spec.id} → ${spec.accelerator} (${spec.scope})`)
      notify()
      return toDisposable(() => {
        specs.delete(spec.id)
        notify()
      })
    },
    list: () => [...specs.values()],
    match(input, focus) {
      for (const spec of specs.values()) {
        if (focus === NATIVE_VIEW_FOCUS && spec.scope !== SHORTCUT_SCOPE.global) continue
        if (matchesChord(parseAccelerator(spec.accelerator, platform), input)) return spec
      }
      return undefined
    },
    onChange(cb) {
      listeners.add(cb)
      return toDisposable(() => listeners.delete(cb))
    },
  }
}
