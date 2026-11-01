import { BACKSLASH_RE, HOST, URL_PARAMS, WIN_DRIVE_PATH_RE, WIN32 } from '../../constants'

const SLASH = '/'

/** The workbench's `folder` URI path: posix unchanged; win32 `C:\a b\x` → `/C:/a b/x`. */
export function folderUriPath(folderPath: string, platform: NodeJS.Platform = process.platform): string {
  if (platform !== WIN32 && !WIN_DRIVE_PATH_RE.test(folderPath)) return folderPath
  return `${SLASH}${folderPath.replace(BACKSLASH_RE, SLASH)}`
}

/** `http://127.0.0.1:<port>/?folder=<path>&tkn=<token>` (the server swaps `tkn` for a cookie). */
export function workbenchUrl(o: {
  port: number
  token: string
  folderPath: string
  platform?: NodeJS.Platform
}): string {
  const folder = encodeURIComponent(folderUriPath(o.folderPath, o.platform))
  return `http://${HOST}:${o.port}/?${URL_PARAMS.folder}=${folder}&${URL_PARAMS.token}=${encodeURIComponent(o.token)}`
}
