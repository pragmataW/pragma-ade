import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ClaudeIcon from '../../providers/claude/src/renderer/icon'
import CustomIcon from '../../providers/custom/src/renderer/icon'
import OpenCodeIcon from '../../providers/opencode/src/renderer/icon'

describe('icon renders the monogram', () => {
  it.each([
    ['claude', ClaudeIcon, 'CL'],
    ['opencode', OpenCodeIcon, 'OC'],
    ['custom', CustomIcon, '>_'],
  ])('%s', (_id, Icon, letters) => {
    const { container } = render(<Icon size={20} className="mark" />)
    expect(screen.getByText(letters)).toBeInTheDocument()
    const el = container.firstElementChild as HTMLElement
    expect(el.style.width).toBe('20px')
    expect(el.className).toContain('mark')
  })
})
