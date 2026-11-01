import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, resolve, sep } from 'node:path'
import { DEFAULT_MIME, HTTP_STATUS, INDEX_HTML, LOCALHOST, STATIC_MIME_TYPES } from './constants'

export interface StaticServer {
  url: string
  port: number
  close(): Promise<void>
}

function resolveRequest(root: string, url: string): { status: number; file?: string } {
  const pathname = decodeURIComponent(url.split('?')[0] ?? '')
  const target = resolve(root, `.${pathname}`)
  if (target !== root && !target.startsWith(`${root}${sep}`)) return { status: HTTP_STATUS.forbidden }
  const file = existsSync(target) && statSync(target).isDirectory() ? join(target, INDEX_HTML) : target
  return existsSync(file) ? { status: HTTP_STATUS.ok, file } : { status: HTTP_STATUS.notFound }
}

/** Serves `dir` on 127.0.0.1 (a local page fixture for browser/E2E tests). */
export function startStaticServer(
  dir: string,
  opts: { port?: number; headers?: Record<string, string> } = {},
): Promise<StaticServer> {
  const root = resolve(dir)
  const server = createServer((req, res) => {
    const { status, file } = resolveRequest(root, req.url ?? '/')
    if (!file) {
      res.writeHead(status).end()
      return
    }
    res.writeHead(status, { 'content-type': STATIC_MIME_TYPES[extname(file)] ?? DEFAULT_MIME, ...opts.headers })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolveServer) => {
    server.listen(opts.port ?? 0, LOCALHOST, () => {
      const { port } = server.address() as AddressInfo
      resolveServer({
        url: `http://${LOCALHOST}:${port}`,
        port,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections()
            server.close(() => done())
          }),
      })
    })
  })
}
