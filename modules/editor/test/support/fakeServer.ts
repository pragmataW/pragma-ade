import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ServerCommand } from '../../src/main/server/serverProcess'
import { FAKE_SERVER_SOURCE } from './makeFakeArchive'

/** Runs the fake server with the current node (no shell script). */
export const fakeServerCommand = (): ServerCommand => ({
  command: process.execPath,
  argsPrefix: [FAKE_SERVER_SOURCE],
  shell: false,
})

export type FakeLogEntry = {
  type: string
  pid: number
  argv?: string[]
  env?: Record<string, string>
  childPid?: number
}

export const readFakeLog = (file: string): FakeLogEntry[] =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as FakeLogEntry)
    : []

export const fakeLogPath = (dir: string, name: string): string => join(dir, `${name}.jsonl`)

export const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
