import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { chmod, mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from '@pragma/sdk'
import { readJsonFile, writeFileAtomic } from '@pragma/sdk/main'
import { x as untar } from 'tar'
import { EXEC_MODE, HEX, INSTALL_MARKER, JSON_INDENT, RANDOM_SUFFIX_BYTES, TMP_DIR_INFIX } from '../../constants'

export { INSTALL_MARKER }

const InstallMarkerSchema = z.object({ version: z.string(), sha256: z.string(), installedAt: z.string() })
export type InstallMarker = z.infer<typeof InstallMarkerSchema>

export type ExtractResult = { ok: true } | { ok: false; reason: 'invalidArchive'; detail: string }

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** tar.gz → `${targetDir}.tmp-<random>` → atomic rename → marker written last. */
export async function extractInstall(
  archive: string,
  targetDir: string,
  o: { stripComponents: number; binRelPath: string; version: string; sha256: string },
): Promise<ExtractResult> {
  const tmp = `${targetDir}${TMP_DIR_INFIX}${randomBytes(RANDOM_SUFFIX_BYTES).toString(HEX)}`
  await mkdir(tmp, { recursive: true })
  try {
    await untar({ file: archive, cwd: tmp, strip: o.stripComponents })
    const bin = join(tmp, o.binRelPath)
    if (!existsSync(bin)) throw new Error(`missing ${o.binRelPath}`)
    await chmod(bin, EXEC_MODE)
    await rm(targetDir, { recursive: true, force: true })
    await rename(tmp, targetDir)
  } catch (error) {
    await rm(tmp, { recursive: true, force: true })
    return { ok: false, reason: 'invalidArchive', detail: errorText(error) }
  }
  const marker: InstallMarker = { version: o.version, sha256: o.sha256, installedAt: new Date().toISOString() }
  writeFileAtomic(join(targetDir, INSTALL_MARKER), JSON.stringify(marker, null, JSON_INDENT))
  return { ok: true }
}

function readMarker(dir: string): InstallMarker | null {
  const r = readJsonFile(join(dir, INSTALL_MARKER), InstallMarkerSchema)
  return r.ok ? r.value : null
}

/** Marker present, same version, and the server binary exists. */
export async function isInstalled(dir: string, version: string, binRelPath?: string): Promise<boolean> {
  const marker = readMarker(dir)
  if (marker?.version !== version) return false
  if (!binRelPath) return true
  return stat(join(dir, binRelPath)).then(
    () => true,
    () => false,
  )
}

/** True when `dir` holds an install marker (any version). */
export const hasInstallMarker = (dir: string): boolean => existsSync(join(dir, INSTALL_MARKER))
