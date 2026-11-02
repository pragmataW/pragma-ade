import { open } from 'node:fs/promises'
import {
  CPU_TYPE,
  ELF_MACHINE,
  ELF_MACHINE_OFFSET,
  ELF_MAGIC,
  ELF_TYPE_OFFSET,
  ET_EXEC,
  FAT_ENTRIES_OFFSET,
  FAT_ENTRY_STRIDE,
  FAT_MAGIC,
  FAT_MAGIC_64,
  FAT_NARCH_OFFSET,
  FAT64_ENTRY_STRIDE,
  HEADER_BYTES,
  MACHO_CPUTYPE_OFFSET,
  MACHO_FILETYPE_OFFSET,
  MACHO64_MAGIC_LE,
  MAX_FAT_ARCHES,
  MH_EXECUTE,
  MZ_MAGIC,
  PE_CHARACTERISTICS_OFFSET,
  PE_DLL_FLAG,
  PE_LFANEW_OFFSET,
  PE_MACHINE,
  PE_MACHINE_OFFSET,
  PE_SIGNATURE,
  U16_BYTES,
  U32_BYTES,
} from '../constants.ts'
import { type BinaryFormat, FORMAT, type Target } from './targets.ts'

export const MACHINES = ['arm64', 'x64', 'ia32', 'other'] as const
export type Machine = (typeof MACHINES)[number]
export interface BinaryInfo {
  format: BinaryFormat
  arches: Machine[]
  executable: boolean
}

type MachineTable = Readonly<Record<Exclude<Machine, 'other'>, number>>
const OTHER: Machine = 'other'

function machineOf(table: MachineTable, value: number): Machine {
  const hit = (Object.entries(table) as [Machine, number][]).find(([, v]) => v === value)
  return hit ? hit[0] : OTHER
}

const fits = (buf: Buffer, offset: number, bytes: number): boolean => offset >= 0 && offset + bytes <= buf.length

function detectMacho(buf: Buffer): BinaryInfo | null {
  if (!fits(buf, MACHO_FILETYPE_OFFSET, U32_BYTES) || buf.readUInt32LE(0) !== MACHO64_MAGIC_LE) return null
  return {
    format: FORMAT.macho,
    arches: [machineOf(CPU_TYPE, buf.readUInt32LE(MACHO_CPUTYPE_OFFSET))],
    executable: buf.readUInt32LE(MACHO_FILETYPE_OFFSET) === MH_EXECUTE,
  }
}

/** Universal binaries; the arch count bound rejects Java class files (same magic). */
function detectFat(buf: Buffer): BinaryInfo | null {
  if (!fits(buf, FAT_ENTRIES_OFFSET, 0)) return null
  const magic = buf.readUInt32BE(0)
  if (magic !== FAT_MAGIC && magic !== FAT_MAGIC_64) return null
  const count = buf.readUInt32BE(FAT_NARCH_OFFSET)
  if (count < 1 || count > MAX_FAT_ARCHES) return null
  const stride = magic === FAT_MAGIC_64 ? FAT64_ENTRY_STRIDE : FAT_ENTRY_STRIDE
  const arches: Machine[] = []
  for (let i = 0; i < count; i++) {
    const at = FAT_ENTRIES_OFFSET + i * stride
    if (!fits(buf, at, U32_BYTES)) break
    arches.push(machineOf(CPU_TYPE, buf.readUInt32BE(at)))
  }
  // a fat file's filetype sits in the first slice, outside the header window: executable-ness is unknown
  return { format: FORMAT.macho, arches, executable: false }
}

function detectElf(buf: Buffer): BinaryInfo | null {
  if (!fits(buf, ELF_MACHINE_OFFSET, U16_BYTES) || buf.readUInt32BE(0) !== ELF_MAGIC) return null
  return {
    format: FORMAT.elf,
    arches: [machineOf(ELF_MACHINE, buf.readUInt16LE(ELF_MACHINE_OFFSET))],
    executable: buf.readUInt16LE(ELF_TYPE_OFFSET) === ET_EXEC,
  }
}

function detectPe(buf: Buffer): BinaryInfo | null {
  if (!fits(buf, PE_LFANEW_OFFSET, U32_BYTES) || buf.readUInt16LE(0) !== MZ_MAGIC) return null
  const sig = buf.readUInt32LE(PE_LFANEW_OFFSET)
  if (!fits(buf, sig + PE_CHARACTERISTICS_OFFSET, U16_BYTES) || buf.readUInt32LE(sig) !== PE_SIGNATURE) return null
  const characteristics = buf.readUInt16LE(sig + PE_CHARACTERISTICS_OFFSET)
  return {
    format: FORMAT.pe,
    arches: [machineOf(PE_MACHINE, buf.readUInt16LE(sig + PE_MACHINE_OFFSET))],
    executable: (characteristics & PE_DLL_FLAG) === 0,
  }
}

const DETECTORS = [detectMacho, detectFat, detectElf, detectPe] as const

/** Format and CPU of a Mach-O / ELF / PE header (the first `HEADER_BYTES`), or null for anything else. */
export function detectBinary(header: Buffer): BinaryInfo | null {
  const buf = header.subarray(0, HEADER_BYTES)
  for (const detect of DETECTORS) {
    const info = detect(buf)
    if (info) return info
  }
  return null
}

export async function detectBinaryFile(path: string): Promise<BinaryInfo | null> {
  const handle = await open(path, 'r')
  try {
    const buf = Buffer.alloc(HEADER_BYTES)
    const { bytesRead } = await handle.read(buf, 0, HEADER_BYTES, 0)
    return detectBinary(buf.subarray(0, bytesRead))
  } finally {
    await handle.close()
  }
}

export const matchesTarget = (info: BinaryInfo, target: Target): boolean =>
  info.format === target.binaryFormat && info.arches.includes(target.arch)
