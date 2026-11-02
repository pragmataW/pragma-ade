import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:net'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { choosePort, writeConnectionToken } from '../src/main/server/serverState'
import { tempDir } from './support/httpFixture'

const tmp = tempDir()
afterAll(() => tmp.cleanup())
let n = 0
const stateFile = (port?: number): string => {
  const f = join(tmp.dir, `state-${++n}.json`)
  if (port !== undefined) writeFileSync(f, JSON.stringify({ port }))
  return f
}
const hold = (port: number): Promise<Server> =>
  new Promise((resolve) => {
    const s = createServer()
    s.listen(port, '127.0.0.1', () => resolve(s))
  })
const release = (s: Server): Promise<void> => new Promise((r) => s.close(() => r()))

describe('choosePort', () => {
  it('persists a new port when there is no state', async () => {
    const f = stateFile()
    const r = await choosePort(f)
    expect(r.portChanged).toBe(false)
    expect(JSON.parse(readFileSync(f, 'utf8')).port).toBe(r.port)
  })

  it('reuses persisted port when free', async () => {
    const first = await choosePort(stateFile())
    const f = stateFile(first.port)
    expect(await choosePort(f)).toEqual({ port: first.port, portChanged: false })
  })

  it('retries the preferred port before giving up', async () => {
    const { port } = await choosePort(stateFile())
    const held = await hold(port)
    setTimeout(() => void release(held), 400)
    expect(await choosePort(stateFile(port), { retries: 5, retryDelayMs: 300 })).toEqual({ port, portChanged: false })
  })

  it('reports portChanged when the port stays busy and persists the new port', async () => {
    const { port } = await choosePort(stateFile())
    const held = await hold(port)
    const f = stateFile(port)
    const r = await choosePort(f, { retries: 2, retryDelayMs: 50 })
    await release(held)
    expect(r.portChanged).toBe(true)
    expect(r.port).not.toBe(port)
    expect(JSON.parse(readFileSync(f, 'utf8')).port).toBe(r.port)
  })
})

describe('writeConnectionToken', () => {
  it('token file is 0600 and 64 hex chars', async () => {
    const f = join(tmp.dir, 'token')
    const token = await writeConnectionToken(f)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(readFileSync(f, 'utf8')).toBe(token)
    if (process.platform !== 'win32') expect(statSync(f).mode & 0o777).toBe(0o600)
  })
})
