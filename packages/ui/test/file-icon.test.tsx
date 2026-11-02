import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FileIcon, iconUrl } from '../src/components/file-icon'

afterEach(() => document.documentElement.removeAttribute('data-theme'))

describe('FileIcon', () => {
  it('draws the Material icon of a file as a served svg', () => {
    const { container } = render(<FileIcon path="src/index.ts" />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.dataset.icon).toBe('typescript')
    expect(img.getAttribute('src')).toMatch(/typescript\.svg/)
    expect(img.getAttribute('aria-hidden')).toBe('true')
  })

  it('draws open and closed folders', () => {
    const { container, rerender } = render(<FileIcon path="src" folder />)
    expect(container.querySelector('img')?.dataset.icon).toBe('folder-src')
    rerender(<FileIcon path="src" folder open />)
    expect(container.querySelector('img')?.dataset.icon).toBe('folder-src-open')
  })

  it('switches to light variants with the shell theme', async () => {
    const { container } = render(<FileIcon path="Cargo.toml" />)
    expect(container.querySelector('img')?.dataset.icon).toBe('toml')
    // MutationObserver records are delivered as a microtask.
    await act(async () => document.documentElement.setAttribute('data-theme', 'light'))
    expect(container.querySelector('img')?.dataset.icon).toBe('toml_light')
  })

  it('has a url for the generic icons', () => {
    for (const icon of ['file', 'folder', 'folder-open']) expect(iconUrl(icon)).toBeTruthy()
  })
})
