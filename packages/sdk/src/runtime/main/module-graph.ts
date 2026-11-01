import type { ModuleStateReason } from '../../common/core-ipc'
import type { ModuleManifest } from '../../common/manifest'

export type GraphManifest = Pick<ModuleManifest, 'id' | 'dependsOn' | 'optionalDependsOn' | 'core'>

export interface ExcludedModule {
  id: string
  reason: Extract<ModuleStateReason, 'user' | 'missing-dependency' | 'cycle' | 'dependency-disabled'>
  detail?: string
}

export interface ModuleGraph {
  /** Activation order; also the cross-module migration order (§10.1.4). */
  order: string[]
  excluded: ExcludedModule[]
}

const LIST_SEPARATOR = ', '

type Edges = (m: GraphManifest) => readonly string[]

const requiredEdges: Edges = (m) => m.dependsOn
const allEdges: Edges = (m) => [...m.dependsOn, ...m.optionalDependsOn]

/** Kahn's algorithm with a lexical tie-break; returns the sorted ids and the ones left over. */
function kahn(nodes: GraphManifest[], edges: Edges, done: ReadonlySet<string>): { order: string[]; stuck: string[] } {
  const ids = new Set(nodes.map((n) => n.id))
  const pending = new Map(nodes.map((n) => [n.id, edges(n).filter((d) => ids.has(d) && !done.has(d))]))
  const order: string[] = []
  for (;;) {
    const ready = [...pending].filter(([, deps]) => deps.every((d) => !pending.has(d))).map(([id]) => id)
    const next = ready.sort()[0]
    if (next === undefined) break
    order.push(next)
    pending.delete(next)
  }
  return { order, stuck: [...pending.keys()].sort() }
}

function reaches(from: string, target: string, byId: Map<string, GraphManifest>, inSet: ReadonlySet<string>) {
  const seen = new Set<string>()
  const stack = [...(byId.get(from)?.dependsOn ?? [])]
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (id === target) return true
    if (seen.has(id) || !inSet.has(id)) continue
    seen.add(id)
    stack.push(...(byId.get(id)?.dependsOn ?? []))
  }
  return false
}

function staticExclusions(manifests: GraphManifest[], disabled: ReadonlySet<string>): Map<string, ExcludedModule> {
  const ids = new Set(manifests.map((m) => m.id))
  const excluded = new Map<string, ExcludedModule>()
  for (const m of manifests) {
    const missing = m.dependsOn.filter((d) => !ids.has(d))
    if (missing.length > 0)
      excluded.set(m.id, { id: m.id, reason: 'missing-dependency', detail: missing.join(LIST_SEPARATOR) })
    else if (disabled.has(m.id) && !m.core) excluded.set(m.id, { id: m.id, reason: 'user' })
  }
  return excluded
}

function cascade(manifests: GraphManifest[], excluded: Map<string, ExcludedModule>): void {
  let changed = true
  while (changed) {
    changed = false
    for (const m of manifests) {
      const dep = excluded.has(m.id) ? undefined : m.dependsOn.find((d) => excluded.has(d))
      if (dep === undefined) continue
      excluded.set(m.id, { id: m.id, reason: 'dependency-disabled', detail: dep })
      changed = true
    }
  }
}

export function resolveModuleGraph(
  manifests: readonly GraphManifest[],
  opts: { disabled: Iterable<string> },
): ModuleGraph {
  const list = [...manifests]
  const excluded = staticExclusions(list, new Set(opts.disabled))
  cascade(list, excluded)
  const remaining = list.filter((m) => !excluded.has(m.id))
  const first = kahn(remaining, allEdges, new Set())
  const stuckNodes = remaining.filter((m) => first.stuck.includes(m.id))
  const second = kahn(stuckNodes, requiredEdges, new Set(first.order))
  const byId = new Map(list.map((m) => [m.id, m]))
  const stuck = new Set(second.stuck)
  for (const id of second.stuck)
    if (reaches(id, id, byId, stuck))
      excluded.set(id, { id, reason: 'cycle', detail: second.stuck.join(LIST_SEPARATOR) })
  cascade(list, excluded)
  const order = [...first.order, ...second.order].filter((id) => !excluded.has(id))
  return { order, excluded: [...excluded.values()].sort((a, b) => a.id.localeCompare(b.id)) }
}
