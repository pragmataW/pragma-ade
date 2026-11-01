import type { DaemonMessage, DaemonRequest, DaemonResponse } from '../../packages/pty-daemon/src/protocol'
import type { Transport } from '../../packages/pty-daemon/src/transport'
import { waitFor } from './process'

type Request = DaemonRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never

/** An in-memory transport pair: `transport` goes to the daemon, the rest is the test's (main's) side. */
export function memoryTransport() {
  const received: DaemonMessage[] = []
  let deliver: ((raw: unknown) => void) | undefined
  let close: (() => void) | undefined
  let nextId = 1
  const transport: Transport = {
    send: (msg) => received.push(structuredClone(msg)),
    onMessage: (cb) => {
      deliver = cb
    },
    onClose: (cb) => {
      close = cb
    },
  }
  const responseTo = (id: number) => received.find((m): m is DaemonResponse => m.kind === 'response' && m.id === id)
  return {
    transport,
    received,
    events: () => received.filter((m) => m.kind !== 'response'),
    sendRaw: (raw: unknown) => deliver?.(raw),
    /** Sends a request and waits for its response. */
    async request(req: Request, timeoutMs?: number): Promise<DaemonResponse> {
      const id = nextId++
      deliver?.({ ...req, id })
      return waitFor(() => responseTo(id), timeoutMs)
    },
    responseTo,
    close: () => close?.(),
  }
}
