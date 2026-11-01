export const TEMP_PREFIX = 'pragma-test-'
export const WORKSPACE_MARKER = 'pnpm-workspace.yaml'
export const DEFAULT_BRANCH = 'main'
export const GIT_AUTHOR = { name: 'Pragma Test', email: 'test@pragma.invalid' } as const
export const NULL_DEVICE = '/dev/null'
export const LOCALHOST = '127.0.0.1'
export const INDEX_HTML = 'index.html'
export const HTTP_STATUS = { ok: 200, forbidden: 403, notFound: 404 } as const
export const DEFAULT_MIME = 'application/octet-stream'
export const STATIC_MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8',
}
export const UTF8 = 'utf8'
export const TEST_APP_VERSION = '0.0.0-test'
export const CORE_TEST_LOCALES = { en: { dialogs: { confirm: 'OK', cancel: 'Cancel' } } }
