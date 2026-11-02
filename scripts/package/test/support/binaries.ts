import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  CPU_TYPE,
  ELF_MACHINE,
  ELF_MAGIC,
  FAT_MAGIC,
  HEADER_BYTES,
  MACHO64_MAGIC_LE,
  MH_EXECUTE,
  MZ_MAGIC,
  PE_DLL_FLAG,
  PE_LFANEW_OFFSET,
  PE_MACHINE,
  PE_SIGNATURE,
} from '../../constants.ts'

type Arch = keyof typeof CPU_TYPE
const MH_BUNDLE = 8
const ET_DYN = 3
const PE_HEADER_AT = 0x80
const PE_EXECUTABLE_IMAGE = 0x0002

/** A thin 64-bit Mach-O header (`exec` → MH_EXECUTE, else MH_BUNDLE like a `.node`). */
export function machoHeader(arch: Arch, opts: { exec?: boolean } = {}): Buffer {
  const b = Buffer.alloc(HEADER_BYTES)
  b.writeUInt32LE(MACHO64_MAGIC_LE, 0)
  b.writeUInt32LE(CPU_TYPE[arch], 4)
  b.writeUInt32LE(opts.exec ? MH_EXECUTE : MH_BUNDLE, 12)
  return b
}

export function fatHeader(arches: readonly Arch[]): Buffer {
  const b = Buffer.alloc(HEADER_BYTES)
  b.writeUInt32BE(FAT_MAGIC, 0)
  b.writeUInt32BE(arches.length, 4)
  for (const [i, a] of arches.entries()) b.writeUInt32BE(CPU_TYPE[a], 8 + i * 20)
  return b
}

export function elfHeader(arch: Arch, opts: { exec?: boolean } = {}): Buffer {
  const b = Buffer.alloc(HEADER_BYTES)
  b.writeUInt32BE(ELF_MAGIC, 0)
  b.writeUInt16LE(opts.exec ? 2 : ET_DYN, 16)
  b.writeUInt16LE(ELF_MACHINE[arch], 18)
  return b
}

export function peHeader(arch: Arch, opts: { dll?: boolean } = {}): Buffer {
  const b = Buffer.alloc(HEADER_BYTES)
  b.writeUInt16LE(MZ_MAGIC, 0)
  b.writeUInt32LE(PE_HEADER_AT, PE_LFANEW_OFFSET)
  b.writeUInt32LE(PE_SIGNATURE, PE_HEADER_AT)
  b.writeUInt16LE(PE_MACHINE[arch], PE_HEADER_AT + 4)
  b.writeUInt16LE(PE_EXECUTABLE_IMAGE | (opts.dll ? PE_DLL_FLAG : 0), PE_HEADER_AT + 22)
  return b
}

export function writeBinary(path: string, buf: Buffer, mode = 0o644): string {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, buf)
  chmodSync(path, mode)
  return path
}
