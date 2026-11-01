import { CORE_MODULE_ID } from '../constants'
import { SCOPED_ID_PATTERN } from './patterns'

export interface ServiceToken<T> {
  readonly id: string
  readonly moduleId: string
  /** Phantom field carrying the service type. */
  readonly __service?: T
}

export class InvalidScopedIdError extends Error {}

export function scopedModuleId(id: string, what: string): string {
  const moduleId = SCOPED_ID_PATTERN.exec(id)?.groups?.moduleId
  if (!moduleId) throw new InvalidScopedIdError(`${what} id "${id}" must be "<module-id>.<name>"`)
  return moduleId
}

/** Tokens live in the owning module's contract; `core.*` tokens are provided by the shell. */
export function createServiceToken<T>(id: string): ServiceToken<T> {
  return { id, moduleId: scopedModuleId(id, 'service') }
}

export const isCoreToken = (token: ServiceToken<unknown>): boolean => token.moduleId === CORE_MODULE_ID
