import { describe, expect, it } from 'vitest'
import { workbenchUrl } from '../src/main/views/workbenchUrl'

const query = (url: string) => new URL(url).search

describe('workbenchUrl', () => {
  it('posix with space and unicode', () => {
    const url = workbenchUrl({ port: 4711, token: 't', folderPath: '/Users/a b/ç', platform: 'darwin' })
    expect(url.startsWith('http://127.0.0.1:4711/?')).toBe(true)
    expect(query(url)).toContain('folder=%2FUsers%2Fa%20b%2F%C3%A7')
  })

  it('win32 drive', () => {
    const url = workbenchUrl({ port: 1, token: 't', folderPath: 'C:\\work\\x', platform: 'win32' })
    expect(query(url)).toContain('folder=%2FC%3A%2Fwork%2Fx')
  })

  it('token is in tkn param', () => {
    const url = workbenchUrl({ port: 1, token: 'abc123', folderPath: '/x', platform: 'linux' })
    expect(new URL(url).searchParams.get('tkn')).toBe('abc123')
    expect(new URL(url).searchParams.get('folder')).toBe('/x')
  })
})
