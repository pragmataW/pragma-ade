import { MODULE_STATE, MODULE_STATE_REASON, type ModuleStateReason, type ModuleStatus } from '../../common/core-ipc'
import type { Disposable } from '../../common/disposable'
import type { MainModule } from '../../main/types'
import type { HostCore } from './host-core'
import { applyMigrations } from './migrations'
import { createModuleContext } from './module-context'
import type { ModuleGraph } from './module-graph'
import type { ModuleRecord } from './types'

export interface ActiveModule {
  id: string
  main?: MainModule<unknown>
  disposables: Disposable[]
}

const FAILED_REASONS = new Set<ModuleStateReason>([
  MODULE_STATE_REASON.missingDependency,
  MODULE_STATE_REASON.cycle,
  MODULE_STATE_REASON.activateError,
  MODULE_STATE_REASON.migrationError,
])

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export function baseStatus(record: ModuleRecord): Omit<ModuleStatus, 'state'> {
  const m = record.manifest
  return {
    id: m.id,
    packageName: record.packageName,
    version: record.version,
    kind: m.kind,
    displayNameKey: m.displayNameKey,
    core: m.core,
    dependsOn: m.dependsOn,
    optionalDependsOn: m.optionalDependsOn,
  }
}

export function statusFor(record: ModuleRecord, reason?: ModuleStateReason, detail?: string): ModuleStatus {
  if (!reason) return { ...baseStatus(record), state: MODULE_STATE.active }
  const state = FAILED_REASONS.has(reason) ? MODULE_STATE.failed : MODULE_STATE.disabled
  return { ...baseStatus(record), state, reason, ...(detail ? { detail } : {}) }
}

class ModuleActivationError extends Error {
  readonly reason: ModuleStateReason
  constructor(reason: ModuleStateReason, message: string) {
    super(message)
    this.reason = reason
  }
}

function migrate(core: HostCore, record: ModuleRecord): void {
  if (record.main?.migrations !== true) return
  const id = record.manifest.id
  const result = applyMigrations(core.database.sqlite, [{ module: id, migrations: record.migrations }])
  if (result.failed)
    throw new ModuleActivationError(
      MODULE_STATE_REASON.migrationError,
      `${result.failed.name}: ${messageOf(result.failed.error)}`,
    )
}

async function activateOne(core: HostCore, record: ModuleRecord): Promise<ActiveModule> {
  const id = record.manifest.id
  migrate(core, record)
  const main = record.main
  if (main?.settings && !core.settings.has(id)) core.settings.registerSection(id, main.settings)
  const { ctx, disposables } = createModuleContext(core, record)
  try {
    await main?.activate(ctx)
    if (core.testMode && record.testHooks) await (await record.testHooks()).default(ctx)
  } catch (error) {
    for (const d of disposables.reverse()) d.dispose()
    throw new ModuleActivationError(MODULE_STATE_REASON.activateError, messageOf(error))
  }
  return { id, main, disposables }
}

/** Activates modules in graph order; a failure marks the module failed and its dependents disabled. */
export async function activateAll(
  core: HostCore,
  records: ReadonlyMap<string, ModuleRecord>,
  graph: ModuleGraph,
): Promise<{ statuses: Map<string, ModuleStatus>; active: ActiveModule[] }> {
  const statuses = new Map<string, ModuleStatus>()
  for (const ex of graph.excluded) {
    const record = records.get(ex.id)
    if (record) statuses.set(ex.id, statusFor(record, ex.reason, ex.detail))
  }
  const active: ActiveModule[] = []
  for (const id of graph.order) {
    const record = records.get(id) as ModuleRecord
    const blocked = record.manifest.dependsOn.find((d) => statuses.get(d)?.state !== MODULE_STATE.active)
    if (blocked) {
      statuses.set(id, statusFor(record, MODULE_STATE_REASON.dependencyDisabled, blocked))
      continue
    }
    try {
      active.push(await activateOne(core, record))
      statuses.set(id, statusFor(record))
    } catch (error) {
      const reason = error instanceof ModuleActivationError ? error.reason : MODULE_STATE_REASON.activateError
      core.log.error(`module ${id} failed to activate (${reason})`, error)
      statuses.set(id, statusFor(record, reason, messageOf(error)))
    }
  }
  return { statuses, active }
}
