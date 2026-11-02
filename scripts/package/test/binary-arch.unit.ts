import { describe, expect, it } from 'vitest'
import { type BinaryInfo, detectBinary, detectBinaryFile, matchesTarget } from '../lib/binary-arch.ts'
import { TARGETS, type TargetId } from '../lib/targets.ts'
import { elfHeader, fatHeader, machoHeader, peHeader } from './support/binaries.ts'

describe('detectBinary', () => {
  it.each<[string, Buffer, BinaryInfo | null]>([
    ['thin arm64 exec', machoHeader('arm64', { exec: true }), { format: 'macho', arches: ['arm64'], executable: true }],
    ['thin x64 bundle', machoHeader('x64'), { format: 'macho', arches: ['x64'], executable: false }],
    ['fat x64+arm64', fatHeader(['x64', 'arm64']), { format: 'macho', arches: ['x64', 'arm64'], executable: false }],
    ['ELF x64 shared', elfHeader('x64'), { format: 'elf', arches: ['x64'], executable: false }],
    ['ELF arm64 exec', elfHeader('arm64', { exec: true }), { format: 'elf', arches: ['arm64'], executable: true }],
    ['PE x64 DLL', peHeader('x64', { dll: true }), { format: 'pe', arches: ['x64'], executable: false }],
    ['PE ia32 exe', peHeader('ia32'), { format: 'pe', arches: ['ia32'], executable: true }],
    ['Java class', Buffer.from('cafebabe00000034', 'hex'), null],
    ['text', Buffer.from('#!/bin/sh\necho hi\n'), null],
    ['empty', Buffer.alloc(0), null],
  ])('%s', (_name, buf, expected) => expect(detectBinary(buf)).toEqual(expected))
})

describe('matchesTarget', () => {
  it.each<[string, Buffer, TargetId, boolean]>([
    ['fat matches darwin-arm64', fatHeader(['x64', 'arm64']), 'darwin-arm64', true],
    ['fat matches darwin-x64', fatHeader(['x64', 'arm64']), 'darwin-x64', true],
    ['thin arm64 not darwin-x64', machoHeader('arm64'), 'darwin-x64', false],
    ['PE ia32 not win32-x64', peHeader('ia32'), 'win32-x64', false],
    ['PE x64 matches win32-x64', peHeader('x64', { dll: true }), 'win32-x64', true],
    ['ELF x64 not win32-x64', elfHeader('x64'), 'win32-x64', false],
  ])('%s', (_name, buf, target, ok) => {
    const info = detectBinary(buf)
    expect(info && matchesTarget(info, TARGETS[target])).toBe(ok)
  })
})

it('real file: /bin/ls contains the host arch', async () => {
  const info = await detectBinaryFile('/bin/ls')
  expect(info?.format).toBe('macho')
  expect(info?.arches).toContain(process.arch)
})
