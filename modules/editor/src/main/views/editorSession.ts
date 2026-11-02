import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Session, WebContents } from 'electron'
import { net } from 'electron'
import {
  CONTENT_TYPE,
  EDITOR_ALLOWED_PERMISSIONS,
  EXTERNAL_PROTOCOLS,
  HOST,
  HTTPS_PROTOCOL,
  HTTPS_SCHEME,
  MIME_BY_EXT,
  MIME_DEFAULT,
  PARENT_SEGMENT,
  WC_EVENTS,
  WEBVIEW_CDN_HOST_SUFFIX,
  WEBVIEW_PRE_PATH,
  WINDOW_OPEN,
} from '../../constants'

const SLASH = '/'
const DENY = { action: WINDOW_OPEN.deny } as const

const parse = (url: string): URL | null => {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** `http://127.0.0.1:<port>` exactly (not `localhost`, not another port). */
export function isEditorOrigin(url: string, port: number): boolean {
  return parse(url)?.origin === `http://${HOST}:${port}`
}

/** Only clipboard access, only for the workbench origin. */
export function permissionAllowed(permission: string, requestingUrl: string, port: number): boolean {
  return (EDITOR_ALLOWED_PERMISSIONS as readonly string[]).includes(permission) && isEditorOrigin(requestingUrl, port)
}

/** `window.open` from the workbench: http(s) goes to the OS browser, everything else is denied. */
export function windowOpenDecision(url: string): { action: 'openExternal' } | { action: 'deny' } {
  const protocol = parse(url)?.protocol
  return protocol && (EXTERNAL_PROTOCOLS as readonly string[]).includes(protocol)
    ? { action: WINDOW_OPEN.openExternal }
    : DENY
}

/** A webview asset request on `*.vscode-cdn.net` → the same file under the local server root; null otherwise. */
export function mapWebviewRequest(url: string, serverRoot: string): string | null {
  const u = parse(url)
  if (u?.protocol !== HTTPS_PROTOCOL || !u.hostname.endsWith(WEBVIEW_CDN_HOST_SUFFIX)) return null
  const at = u.pathname.indexOf(WEBVIEW_PRE_PATH)
  if (at < 0) return null
  const rest = decodeURIComponent(u.pathname.slice(at + WEBVIEW_PRE_PATH.length))
  const parts = rest.split(SLASH)
  if (!rest || parts.includes(PARENT_SEGMENT) || rest.includes('\\')) return null
  return join(serverRoot, WEBVIEW_PRE_PATH, ...parts)
}

async function serveFile(path: string): Promise<Response> {
  const res = await net.fetch(pathToFileURL(path).href)
  const type = MIME_BY_EXT[extname(path)] ?? MIME_DEFAULT
  return new Response(res.body, { status: res.status, headers: { [CONTENT_TYPE]: type } })
}

/** Permission handlers and (optionally) local webview assets for the editor partition. */
export function configureEditorSession(
  ses: Session,
  o: {
    getPort(): number | undefined
    serverRoot(): string | undefined
    serveWebviewsLocally(): boolean
    openExternal(url: string): void
  },
): void {
  const allowed = (permission: string, url: string): boolean => {
    const port = o.getPort()
    return port !== undefined && permissionAllowed(permission, url, port)
  }
  ses.setPermissionRequestHandler((_wc, permission, cb, details) => cb(allowed(permission, details.requestingUrl)))
  ses.setPermissionCheckHandler((_wc, permission, origin, details) =>
    allowed(permission, details.requestingUrl ?? origin),
  )
  if (ses.protocol.isProtocolHandled(HTTPS_SCHEME)) return
  ses.protocol.handle(HTTPS_SCHEME, (req) => {
    const root = o.serverRoot()
    const local = root && o.serveWebviewsLocally() ? mapWebviewRequest(req.url, root) : null
    return local ? serveFile(local) : net.fetch(req, { bypassCustomProtocolHandlers: true })
  })
}

/** Popups go to the OS (http/https only); the view never navigates away from the workbench origin. */
export function hardenEditorWebContents(
  wc: WebContents,
  o: { port: () => number | undefined; openExternal(url: string): void },
): void {
  wc.setWindowOpenHandler(({ url }) => {
    if (windowOpenDecision(url).action === WINDOW_OPEN.openExternal) o.openExternal(url)
    return DENY
  })
  wc.on(WC_EVENTS.willNavigate, (event, url) => {
    const port = o.port()
    if (port === undefined || !isEditorOrigin(url, port)) event.preventDefault()
  })
}
