import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ClaudeIcon from '../../providers/claude/src/renderer/icon'
import CustomIcon from '../../providers/custom/src/renderer/icon'
import OpenCodeIcon from '../../providers/opencode/src/renderer/icon'

describe('icon renders the official logo', () => {
  it.each([
    ['claude', ClaudeIcon],
    ['opencode', OpenCodeIcon],
  ])('%s', (id, Icon) => {
    const { container } = render(<Icon size={20} className="mark" />)
    const el = container.firstElementChild as SVGSVGElement
    expect(el.tagName.toLowerCase()).toBe('svg')
    expect(el.dataset.mark).toBe(id)
    expect(el.getAttribute('width')).toBe('20')
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.getAttribute('class')).toContain('mark')
    expect(el.textContent).toBe('')
  })

  it('falls back to the default mark size', () => {
    const { container } = render(<ClaudeIcon />)
    expect(container.firstElementChild?.getAttribute('height')).toBe('20')
  })
})

describe('custom agents keep the monogram', () => {
  it('custom', () => {
    const { container } = render(<CustomIcon size={20} className="mark" />)
    expect(screen.getByText('>_')).toBeInTheDocument()
    const el = container.firstElementChild as HTMLElement
    expect(el.style.width).toBe('20px')
    expect(el.className).toContain('mark')
  })
})
