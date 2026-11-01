import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { z } from '@pragma/sdk'
import { readJsonFile, writeFileAtomic } from '@pragma/sdk/main'
import {
  HEX,
  HOST,
  JSON_INDENT,
  NODE_EVENT,
  PORT_RETRIES,
  PORT_RETRY_DELAY_MS,
  PRIVATE_FILE_MODE,
  TOKEN_BYTES,
} from '../../constants'

const StateSchema = z.object({ port: z.number().int().min(1) })

/** Listens on `port` (0 = any), returns the bound port and releases it; null when busy. */
const probe = (port: number): Promise<number | null> =>
  new Promise((resolve) => {
    const srv = createServer()
    srv.once(NODE_EVENT.error, () => resolve(null))
    srv.listen(port, HOST, () => {
      const address = srv.address()
      const bound = typeof address === 'object' && address ? address.port : null
      srv.close(() => resolve(bound))
    })
  })

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * The workbench keeps user settings in IndexedDB per origin, so the port must stay stable: retry the persisted port,
 * and only when it stays busy pick a new one (persisted, `portChanged: true`).
 */
export async function choosePort(
  stateFile: string,
  o: { retries?: number; retryDelayMs?: number } = {},
): Promise<{ port: number; portChanged: boolean }> {
  const state = readJsonFile(stateFile, StateSchema)
  const preferred = state.ok ? state.value.port : undefined
  const retries = o.retries ?? PORT_RETRIES
  if (preferred !== undefined)
    for (let attempt = 0; attempt < retries; attempt++) {
      if ((await probe(preferred)) !== null) return { port: preferred, portChanged: false }
      await sleep(o.retryDelayMs ?? PORT_RETRY_DELAY_MS)
    }
  const port = await probe(0)
  if (port === null) throw new Error('no free port on 127.0.0.1')
  writeFileAtomic(stateFile, JSON.stringify({ port }, null, JSON_INDENT))
  return { port, portChanged: preferred !== undefined }
}

/** A new random token (hex) in a 0600 file; the token never goes on a command line. */
export async function writeConnectionToken(file: string): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString(HEX)
  writeFileAtomic(file, token, { mode: PRIVATE_FILE_MODE })
  return token
}
