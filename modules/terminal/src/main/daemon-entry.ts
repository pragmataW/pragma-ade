import { DAEMON_ENTRY_REL_PATH, TERMINAL_MODULE_ID } from '../constants'

/** The daemon bundle (`ctx.paths.resource`), or a build hint when it was never built. */
export function resolveDaemonEntry(
  resource: (moduleId: string, rel: string) => string,
  exists: (p: string) => boolean,
): string {
  const path = resource(TERMINAL_MODULE_ID, DAEMON_ENTRY_REL_PATH)
  if (!exists(path))
    throw new Error(`terminal: pty-daemon bundle missing at ${path}; run the module build (pragma.build)`)
  return path
}
