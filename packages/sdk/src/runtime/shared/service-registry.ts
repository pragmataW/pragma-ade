import { type Disposable, toDisposable } from '../../common/disposable'
import { isCoreToken, type ServiceToken } from '../../common/services'

export class ServiceOwnershipError extends Error {}
export class ServiceAccessError extends Error {}
export class ServiceNotFoundError extends Error {}
export class DuplicateServiceError extends Error {}

export interface ModuleServices {
  provide<T>(token: ServiceToken<T>, impl: T): Disposable
  /** Required dependency: the owner must be in `dependsOn` (or be `core`). */
  get<T>(token: ServiceToken<T>): T
  /** Optional dependency: the owner must be in `dependsOn` or `optionalDependsOn`. */
  tryGet<T>(token: ServiceToken<T>): T | undefined
}

export interface ServiceScopeDeps {
  required: readonly string[]
  optional: readonly string[]
}

export interface ServiceRegistry {
  scope(moduleId: string, deps: ServiceScopeDeps): ModuleServices
  has(token: ServiceToken<unknown>): boolean
}

export function createServiceRegistry(): ServiceRegistry {
  const services = new Map<string, unknown>()

  const scope = (moduleId: string, deps: ServiceScopeDeps): ModuleServices => {
    const own = (token: ServiceToken<unknown>): boolean => token.moduleId === moduleId || isCoreToken(token)
    const assertAccess = (token: ServiceToken<unknown>, allowed: readonly string[]): void => {
      if (own(token) || allowed.includes(token.moduleId)) return
      throw new ServiceAccessError(`module "${moduleId}" uses ${token.id} but does not depend on "${token.moduleId}"`)
    }
    return {
      provide(token, impl) {
        if (token.moduleId !== moduleId)
          throw new ServiceOwnershipError(
            `module "${moduleId}" cannot provide ${token.id} (owned by "${token.moduleId}")`,
          )
        if (services.has(token.id)) throw new DuplicateServiceError(`service ${token.id} is already provided`)
        services.set(token.id, impl)
        return toDisposable(() => services.delete(token.id))
      },
      get<T>(token: ServiceToken<T>): T {
        assertAccess(token, deps.required)
        if (!services.has(token.id)) throw new ServiceNotFoundError(`service ${token.id} is not provided`)
        return services.get(token.id) as T
      },
      tryGet<T>(token: ServiceToken<T>): T | undefined {
        assertAccess(token, [...deps.required, ...deps.optional])
        return services.get(token.id) as T | undefined
      },
    }
  }

  return { scope, has: (token) => services.has(token.id) }
}
