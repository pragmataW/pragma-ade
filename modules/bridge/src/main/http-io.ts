import type { IncomingMessage, ServerResponse } from 'node:http'
import { CONNECTION_CLOSE, HEADERS, JSON_CONTENT_TYPE, NODE_EVENTS, URL_PARSE_BASE } from '../constants'
import { BRIDGE_MAX_BODY_BYTES } from '../contract'

export class BodyTooLargeError extends Error {}

/** Writes a JSON response. */
export function sendJson(res: ServerResponse, status: number, body: unknown, close = false): void {
  const headers: Record<string, string> = { [HEADERS.contentType]: JSON_CONTENT_TYPE }
  if (close) headers[HEADERS.connection] = CONNECTION_CLOSE
  res.writeHead(status, headers)
  res.end(JSON.stringify(body))
}

/** Ends a response without a body (guards that run before routing). */
export function sendStatus(res: ServerResponse, status: number): void {
  res.writeHead(status, { [HEADERS.connection]: CONNECTION_CLOSE })
  res.end()
}

/** Reads the body up to the limit; rejects with `BodyTooLargeError` (and stops buffering) beyond it. */
export function readBody(req: IncomingMessage, limit = BRIDGE_MAX_BODY_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    if (Number(req.headers[HEADERS.contentLength] ?? 0) > limit) {
      req.resume()
      reject(new BodyTooLargeError())
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    const onData = (chunk: Buffer): void => {
      size += chunk.length
      if (size <= limit) {
        chunks.push(chunk)
        return
      }
      req.off(NODE_EVENTS.data, onData)
      req.resume()
      reject(new BodyTooLargeError())
    }
    req.on(NODE_EVENTS.data, onData)
    req.on(NODE_EVENTS.end, () => resolve(Buffer.concat(chunks).toString()))
    req.on(NODE_EVENTS.error, reject)
  })
}

/** `JSON.parse` that returns `undefined` instead of throwing. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** The path of a request URL (query stripped). */
export const pathOf = (req: IncomingMessage): string => new URL(req.url ?? '/', URL_PARSE_BASE).pathname
