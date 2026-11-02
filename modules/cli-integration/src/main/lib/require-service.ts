import { CLI_ERROR } from '../../contract'
import { CliError } from '../cli-error'

/** The only optional-module guard: a disabled `board`/`comments` module → `module_unavailable`. */
export function requireService<T>(svc: T | undefined, moduleId: string): T {
  if (svc === undefined) throw new CliError(CLI_ERROR.module_unavailable, `The ${moduleId} module is disabled.`)
  return svc
}
