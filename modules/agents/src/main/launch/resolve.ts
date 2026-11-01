import { type CommandResolution, RESOLUTION } from '../../contract'

export type ResolveFn = (command: string) => Promise<CommandResolution>

/**
 * Thin adapter over the SDK's `ctx.env.resolveCommand` (login-shell PATH, `command -v` semantics; §10.2). The SDK has
 * no `notExecutable` result, so this module never reports it.
 */
export function createResolve(sdkResolveCommand: (cmd: string) => Promise<string | null>): ResolveFn {
  return async (command) => {
    const path = command.trim() ? await sdkResolveCommand(command) : null
    return path ? { status: RESOLUTION.found, path } : { status: RESOLUTION.notFound }
  }
}
