import {
  LOGIN_SHELL_ARGS,
  POSIX_SHELL,
  POWERSHELL_EXE,
  PWSH_EXE,
  SHELL_ENV,
  SHELL_FALLBACKS,
  WIN32,
} from '../constants'

export interface ShellCommand {
  command: string
  args: string[]
}

export interface DefaultShellOptions {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  /** The `terminal.shell` setting; a non-null value wins (args `[]`). */
  settingShell: string | null
  exists: (path: string) => boolean
  /** `ctx.env.resolveCommand` in production. */
  resolveCommand: (cmd: string) => Promise<string | null>
}

/** The shell a new terminal tab runs. */
export async function defaultShell(o: DefaultShellOptions): Promise<ShellCommand> {
  if (o.settingShell) return { command: o.settingShell, args: [] }
  if (o.platform === WIN32) return { command: (await o.resolveCommand(PWSH_EXE)) ?? POWERSHELL_EXE, args: [] }
  const candidates = [o.env[SHELL_ENV], SHELL_FALLBACKS[o.platform], POSIX_SHELL]
  const command = candidates.filter((c): c is string => Boolean(c)).find((c) => o.exists(c)) ?? POSIX_SHELL
  return { command, args: LOGIN_SHELL_ARGS[o.platform] ?? [] }
}
