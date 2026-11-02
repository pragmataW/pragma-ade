import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const sha256Of = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

export interface HttpFixture {
  url(path: string): string
  close(): Promise<void>
}

/** Serves `body` at `/file`, a 302 to it at `/redirect`, a slow chunked copy at `/slow` and 404 elsewhere. */
export async function startHttpFixture(
  body: Buffer,
  o: { chunk?: number; delayMs?: number } = {},
): Promise<HttpFixture> {
  const chunk = o.chunk ?? 64 * 1024
  const delayMs = o.delayMs ?? 30
  const server: Server = createServer((req, res) => {
    if (req.url === '/file') {
      res.writeHead(200, { 'content-length': body.length })
      res.end(body)
    } else if (req.url === '/redirect') {
      res.writeHead(302, { location: '/file' })
      res.end()
    } else if (req.url === '/slow') {
      res.writeHead(200, { 'content-length': body.length })
      let at = 0
      const tick = (): void => {
        if (res.destroyed) return
        if (at >= body.length) {
          res.end()
          return
        }
        res.write(body.subarray(at, at + chunk))
        at += chunk
        setTimeout(tick, delayMs)
      }
      tick()
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as AddressInfo).port
  return {
    url: (path) => `http://127.0.0.1:${port}${path}`,
    close: () =>
      new Promise((r) => {
        server.closeAllConnections()
        server.close(() => r())
      }),
  }
}

export const randomBody = (bytes: number): Buffer => randomBytes(bytes)

/** A temp dir removed by the returned cleanup. */
export function tempDir(prefix = 'pragma-editor-test-'): { dir: string; cleanup(): void } {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}
