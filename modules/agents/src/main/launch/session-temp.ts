import { mkdir, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@pragma/sdk/main'
import { TEMP_DIR_MODE, TEMP_FILE_MODE } from '../../constants'

const INVALID_NAME = /[\\/]|^\.{0,2}$/

export interface SessionTemp {
  dir: string
  writeTempFile(name: string, contents: string): Promise<string>
}

/** Per-session temp directories (0700) with 0600 files, removed at session end and swept at startup. */
export class SessionTempDirs {
  readonly #root: string

  constructor(root: string) {
    this.#root = root
  }

  async create(sessionId: string): Promise<SessionTemp> {
    const dir = join(this.#root, sessionId)
    await mkdir(this.#root, { recursive: true, mode: TEMP_DIR_MODE })
    await mkdir(dir, { recursive: true, mode: TEMP_DIR_MODE })
    return {
      dir,
      async writeTempFile(name, contents) {
        if (INVALID_NAME.test(name)) throw new Error(`agents: invalid temp file name "${name}"`)
        const path = join(dir, name)
        writeFileAtomic(path, contents, { mode: TEMP_FILE_MODE })
        return path
      },
    }
  }

  async remove(sessionId: string, extraFiles: readonly string[] = []): Promise<void> {
    await rm(join(this.#root, sessionId), { recursive: true, force: true })
    await Promise.all(extraFiles.map((f) => rm(f, { force: true })))
  }

  async sweepAll(): Promise<void> {
    await mkdir(this.#root, { recursive: true, mode: TEMP_DIR_MODE })
    const entries = await readdir(this.#root)
    await Promise.all(entries.map((e) => rm(join(this.#root, e), { recursive: true, force: true })))
  }
}
