import {
  CLI_ERROR,
  type CliMethod,
  type CliRequest,
  type CliResponse,
  type CliResult,
  cliRequestSchemas,
} from '../../contract'
import { CliError } from '../cli-error'
import { toCliError } from '../mappers'

export type CliHandler = (payload: unknown) => Promise<CliResponse>

/** The only place that validates `cli.*` payloads and turns failures into `{ ok: false, error }`. */
export function defineCliHandler<M extends CliMethod>(
  method: M,
  fn: (req: CliRequest<M>) => Promise<CliResult<M>>,
): CliHandler {
  const schema = cliRequestSchemas[method]
  return async (payload) => {
    const parsed = schema.safeParse(payload)
    if (!parsed.success)
      return { ok: false, error: new CliError(CLI_ERROR.invalid_argument, parsed.error.message).toDto() }
    try {
      return { ok: true, result: await fn(parsed.data as CliRequest<M>) }
    } catch (e) {
      return { ok: false, error: toCliError(e).toDto() }
    }
  }
}
