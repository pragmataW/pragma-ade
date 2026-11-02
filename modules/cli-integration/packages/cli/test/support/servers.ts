import { createServer, type Server } from 'node:net'
import { startTestBridgeServer, type TestBridgeServer } from '@pragma/module-bridge/testing'
import { CLI_NAMESPACE, CLI_PING_METHOD, type CliResponse } from '@pragma/module-cli-integration/contract'
import { afterEach } from 'vitest'

const closers: (() => Promise<void> | void)[] = []
afterEach(async () => {
  for (const close of closers.splice(0)) await close()
})

/** A real bridge server with a `cli` namespace whose methods answer with `answers[method](payload)`. */
export async function cliBridge(answers: Record<string, (payload: unknown) => CliResponse>): Promise<TestBridgeServer> {
  const server = await startTestBridgeServer()
  closers.push(() => server.close())
  const handlers = Object.fromEntries(Object.entries(answers).map(([name, answer]) => [name, answer]))
  server.registerHandler(CLI_NAMESPACE, { [CLI_PING_METHOD]: () => ({ ok: true, version: 'test' }), ...handlers })
  return server
}

const listen = (server: Server): Promise<number> =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as { port: number }).port)))

/** A port nothing listens on any more. */
export async function closedPortUrl(): Promise<string> {
  const server = createServer()
  const port = await listen(server)
  await new Promise((r) => server.close(r))
  return `http://127.0.0.1:${port}`
}

/** Accepts TCP connections and never answers. */
export async function silentServerUrl(): Promise<string> {
  const sockets: { destroy(): void }[] = []
  const server = createServer((s) => sockets.push(s))
  const port = await listen(server)
  closers.push(() => {
    for (const s of sockets) s.destroy()
    return new Promise<void>((r) => server.close(() => r()))
  })
  return `http://127.0.0.1:${port}`
}
