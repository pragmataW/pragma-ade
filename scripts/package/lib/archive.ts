import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  APP_ASAR,
  APP_BUNDLE_EXT,
  ARCHIVE_EXT,
  ASAR_UNPACKED_SUFFIX,
  DARWIN,
  DEB_DATA_PREFIX,
  DITTO,
  EXE_EXT,
  HDIUTIL,
  LINUX,
  MAC_CONTENTS,
  MAC_EXECUTABLE_DIR,
  MAC_RESOURCES_DIR,
  NODE_MODULES,
  RESOURCE_MODULES_DIR,
  RESOURCES_DIR,
  TAR,
  TAR_EXTRACT,
  WIN32,
} from '../constants.ts'
import { run } from './exec.ts'
import { copyDir, isDir, mkTemp } from './fsx.ts'
import type { Target } from './targets.ts'

export class ArchiveError extends Error {}

async function extractDmg(path: string, dir: string): Promise<void> {
  const mount = mkTemp('dmg mount')
  await run(HDIUTIL, ['attach', '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mount, path])
  try {
    for (const name of readdirSync(mount).filter((n) => n.endsWith(APP_BUNDLE_EXT)))
      copyDir(join(mount, name), join(dir, name))
  } finally {
    await run(HDIUTIL, ['detach', mount, '-force'], { allowFail: true })
  }
}

async function extractDeb(path: string, dir: string): Promise<void> {
  await run(TAR, [TAR_EXTRACT, path], { cwd: dir })
  const data = readdirSync(dir).find((n) => n.startsWith(DEB_DATA_PREFIX))
  if (!data) throw new ArchiveError(`${path}: no ${DEB_DATA_PREFIX}.* member`)
  await run(TAR, [TAR_EXTRACT, data], { cwd: dir })
}

/** Extracts a zip, deb or dmg into a fresh temp dir (name with a space) and returns it. */
export async function extractArchive(path: string): Promise<string> {
  const dir = mkTemp('extract root')
  if (path.endsWith(ARCHIVE_EXT.zip)) await run(DITTO, ['-x', '-k', path, dir])
  else if (path.endsWith(ARCHIVE_EXT.deb)) await extractDeb(path, dir)
  else if (path.endsWith(ARCHIVE_EXT.dmg)) await extractDmg(path, dir)
  else throw new ArchiveError(`cannot extract ${path}`)
  return dir
}

export interface AppLayout {
  executable: string
  resourcesDir: string
  asar: string
}

export interface AppNames {
  productName: string
  executableName: string
}

const withAsar = (executable: string, resourcesDir: string): AppLayout => ({
  executable,
  resourcesDir,
  asar: join(resourcesDir, APP_ASAR),
})

/** Executable, resources dir and app.asar of an extracted app (darwin: root holds `<productName>.app`). */
export function appLayout(root: string, target: Target, names: AppNames): AppLayout {
  switch (target.platform) {
    case DARWIN: {
      const contents = join(root, `${names.productName}${APP_BUNDLE_EXT}`, MAC_CONTENTS)
      return withAsar(join(contents, MAC_EXECUTABLE_DIR, names.productName), join(contents, MAC_RESOURCES_DIR))
    }
    case LINUX:
      return withAsar(join(root, names.executableName), join(root, RESOURCES_DIR))
    case WIN32:
      return withAsar(join(root, `${names.productName}${EXE_EXT}`), join(root, RESOURCES_DIR))
    default: {
      const never: never = target.platform
      throw new ArchiveError(`unknown platform ${String(never)}`)
    }
  }
}

/** Dirs that hold their own `node_modules`: `app.asar.unpacked` and staged resources below `resources/modules`. */
export function nativeRoots(layout: AppLayout): string[] {
  const roots: string[] = []
  const visit = (dir: string): void => {
    if (!isDir(dir)) return
    const names = readdirSync(dir)
    if (names.includes(NODE_MODULES)) roots.push(dir)
    for (const n of names) if (n !== NODE_MODULES) visit(join(dir, n))
  }
  const unpacked = `${layout.asar}${ASAR_UNPACKED_SUFFIX}`
  if (existsSync(join(unpacked, NODE_MODULES))) roots.push(unpacked)
  visit(join(layout.resourcesDir, RESOURCE_MODULES_DIR))
  return roots
}
