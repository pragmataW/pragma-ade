import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { readJsonFile, writeFileAtomic } from '@pragma/sdk/main'
import { PRIVATE_FILE_MODE } from '../constants'
import { BRIDGE_INFO_FILE, type BridgeInfoFile, BridgeInfoFileSchema } from '../contract'

const infoPath = (dir: string): string => join(dir, BRIDGE_INFO_FILE)

/** Writes `<dir>/bridge.json` atomically with mode 0600; returns its path. */
export function writeInfoFile(dir: string, data: BridgeInfoFile): string {
  const path = infoPath(dir)
  writeFileAtomic(path, JSON.stringify(BridgeInfoFileSchema.parse(data)), { mode: PRIVATE_FILE_MODE })
  return path
}

/** The parsed info file, or null when missing or invalid. */
export function readInfoFile(dir: string): BridgeInfoFile | null {
  const read = readJsonFile(infoPath(dir), BridgeInfoFileSchema)
  return read.ok ? read.value : null
}

/** Removes the info file only when it still belongs to this instance (same token). */
export async function removeInfoFile(dir: string, expectedToken: string): Promise<void> {
  if (readInfoFile(dir)?.token !== expectedToken) return
  await rm(infoPath(dir), { force: true })
}
