import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from '@pragma/sdk'
import { readJsonFile, writeFileAtomic } from '@pragma/sdk/main'
import {
  BRIDGE_EXTENSION_DIR_PREFIX,
  BRIDGE_VSIX_MANIFEST_REL_PATH,
  BRIDGE_VSIX_REL_PATH,
  JSON_INDENT,
  TEST_ENV,
} from '../../constants'
import { EDITOR_ERROR } from '../../contract'
import { installExtensionArgs, type ServerDirs } from './args'

const VsixManifestSchema = z.object({ version: z.string(), sha256: z.string() })
const MANIFEST_FILE = 'manifest.json'

export type BridgeVsix = { vsix: string; version: string; sha256: string }

/** The built `pragma-bridge.vsix` (test override only in test mode); null when it is missing. */
export function locateBridgeVsix(o: {
  env: NodeJS.ProcessEnv
  testMode: boolean
  resource(relPath: string): string
}): BridgeVsix | null {
  const override = o.testMode ? o.env[TEST_ENV.bridgeVsix] : undefined
  const vsix = override ?? o.resource(BRIDGE_VSIX_REL_PATH)
  const manifestPath = override ? join(dirname(override), MANIFEST_FILE) : o.resource(BRIDGE_VSIX_MANIFEST_REL_PATH)
  if (!existsSync(vsix)) return null
  const manifest = readJsonFile(manifestPath, VsixManifestSchema)
  if (!manifest.ok) return null
  return { vsix, ...manifest.value }
}

export class ExtensionInstallError extends Error {}

/** Installs the vsix with `--install-extension` when the marker or the installed folder does not match. */
export async function ensureBridgeExtension(o: {
  vsix: BridgeVsix
  markerFile: string
  run: (args: string[]) => Promise<{ code: number; stderr: string }>
  dirs: ServerDirs
}): Promise<'installed' | 'upToDate'> {
  const marker = readJsonFile(o.markerFile, VsixManifestSchema)
  const installedDir = join(o.dirs.extensionsDir, `${BRIDGE_EXTENSION_DIR_PREFIX}${o.vsix.version}`)
  const same = marker.ok && marker.value.version === o.vsix.version && marker.value.sha256 === o.vsix.sha256
  if (same && existsSync(installedDir)) return 'upToDate'
  const r = await o.run(installExtensionArgs({ vsix: o.vsix.vsix, dirs: o.dirs }))
  if (r.code !== 0) throw new ExtensionInstallError(`${EDITOR_ERROR.extensionInstallFailed}: ${r.stderr.trim()}`)
  writeFileAtomic(o.markerFile, JSON.stringify({ version: o.vsix.version, sha256: o.vsix.sha256 }, null, JSON_INDENT))
  return 'installed'
}
