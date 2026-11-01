import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, win32 } from 'node:path'
import { expect, it } from 'vitest'
import { resolveCommand } from '../src/runtime/main/resolve-command'
import { tempDir } from './lib/builders'

const EXEC = 0o755
const PLAIN = 0o644
const root = tempDir()
const dirA = join(root, 'a')
const dirB = join(root, 'b')
for (const d of [dirA, dirB]) mkdirSync(d)
const file = (dir: string, name: string, mode = EXEC) => {
  const p = join(dir, name)
  writeFileSync(p, '#!/bin/sh\n')
  chmodSync(p, mode)
  return p
}
const tool = file(dirB, 'tool')
file(dirA, 'shadow', PLAIN)
const shadowB = file(dirB, 'shadow')
const nodeExe = win32.join(dirB, 'node.EXE')
const nodeCmd = win32.join(dirA, 'node.cmd')
const posixEnv = { PATH: [dirA, dirB].join(':') }
const winEnv = { Path: [dirA, dirB].join(';'), PATHEXT: '.COM;.EXE' }

it.each([
  ['found in the second PATH entry', 'tool', posixEnv, 'darwin', tool],
  ['not found', 'missing', posixEnv, 'darwin', null],
  ['absolute executable path', tool, posixEnv, 'darwin', tool],
  ['non-executable file is skipped', 'shadow', posixEnv, 'linux', shadowB],
])('%s', async (_name, cmd, env, platform, expected) => {
  expect(await resolveCommand(cmd, { env, platform })).toBe(expected)
})
it.each([
  ['node resolves via PATHEXT', 'node', nodeExe],
  ['node.cmd already has an extension', 'node.cmd', nodeCmd],
])('win32: %s', async (_name, cmd, expected) => {
  const existing = new Set([nodeExe, nodeCmd])
  const access = async (p: string) => {
    if (!existing.has(p)) throw new Error('ENOENT')
  }
  expect(await resolveCommand(cmd, { env: { ...winEnv, PATHEXT: '.COM;.EXE;.CMD' }, platform: 'win32', access })).toBe(
    expected,
  )
})
