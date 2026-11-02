import { join } from 'node:path'
import { SERVER_FLAGS as F, HOST, TELEMETRY_OFF, WIN32 } from '../../constants'
import type { EditorRelease } from '../release/release'

/** `${ud}/editor/{server,data,extensions}`. */
export interface ServerDirs {
  serverDataDir: string
  userDataDir: string
  extensionsDir: string
}

const dirArgs = (d: ServerDirs): string[] => [
  F.serverDataDir,
  d.serverDataDir,
  F.userDataDir,
  d.userDataDir,
  F.extensionsDir,
  d.extensionsDir,
]

export function startArgs(o: { port: number; tokenFile: string; dirs: ServerDirs; graceSeconds: number }): string[] {
  return [
    F.host,
    HOST,
    F.port,
    String(o.port),
    F.connectionTokenFile,
    o.tokenFile,
    F.acceptLicense,
    F.telemetryLevel,
    TELEMETRY_OFF,
    F.disableWorkspaceTrust,
    ...dirArgs(o.dirs),
    F.graceTime,
    String(o.graceSeconds),
  ]
}

export function installExtensionArgs(o: { vsix: string; dirs: ServerDirs }): string[] {
  return [F.installExtension, o.vsix, F.force, F.acceptLicense, ...dirArgs(o.dirs)]
}

/** win32 runs the `.cmd` through the shell; posix runs the script directly. */
export function serverCommand(
  installDir: string,
  rel: EditorRelease,
  platform: NodeJS.Platform,
): { command: string; argsPrefix: string[]; shell: boolean } {
  const win = platform === WIN32
  return { command: join(installDir, win ? rel.binPath.win32 : rel.binPath.posix), argsPrefix: [], shell: win }
}
