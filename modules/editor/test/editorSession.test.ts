import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ net: { fetch: vi.fn() } }))

const { isEditorOrigin, mapWebviewRequest, permissionAllowed, windowOpenDecision } = await import(
  '../src/main/views/editorSession'
)

const CDN = 'https://0a1b2c.vscode-cdn.net/insider/abc/out/vs/workbench/contrib/webview/browser/pre'
const ROOT = '/srv/reh'

describe('editor session policy', () => {
  it.each([
    ['http://127.0.0.1:4711/?folder=x', true],
    ['http://127.0.0.1:4712/', false],
    ['http://localhost:4711/', false],
    ['https://127.0.0.1:4711/', false],
    ['not a url', false],
  ])('isEditorOrigin(%s) = %s', (url, ok) => {
    expect(isEditorOrigin(url, 4711)).toBe(ok)
  })

  it('permissionAllowed clipboard-read only on editor origin', () => {
    expect(permissionAllowed('clipboard-read', 'http://127.0.0.1:1/', 1)).toBe(true)
    expect(permissionAllowed('clipboard-read', 'https://evil.example/', 1)).toBe(false)
    expect(permissionAllowed('notifications', 'http://127.0.0.1:1/', 1)).toBe(false)
    expect(permissionAllowed('media', 'http://127.0.0.1:1/', 1)).toBe(false)
  })

  it.each([
    ['https://open-vsx.org/x', 'openExternal'],
    ['http://example.com', 'openExternal'],
    ['javascript:alert(1)', 'deny'],
    ['file:///etc/passwd', 'deny'],
  ])('windowOpenDecision(%s) → %s', (url, action) => {
    expect(windowOpenDecision(url).action).toBe(action)
  })

  it.each(['index.html', 'service-worker.js'])('mapWebviewRequest maps pre/%s', (file) => {
    expect(mapWebviewRequest(`${CDN}/${file}?id=1&v=2`, ROOT)).toBe(
      join(ROOT, 'out/vs/workbench/contrib/webview/browser/pre', file),
    )
  })

  it.each([
    `${CDN}/%2E%2E/%2E%2E/secret`,
    `${CDN}/../x`,
    'https://example.com/out/vs/workbench/contrib/webview/browser/pre/index.html',
    'http://a.vscode-cdn.net/out/vs/workbench/contrib/webview/browser/pre/index.html',
    'https://a.vscode-cdn.net/other/index.html',
  ])('mapWebviewRequest rejects path traversal and other hosts: %s', (url) => {
    expect(mapWebviewRequest(url, ROOT)).toBeNull()
  })
})
