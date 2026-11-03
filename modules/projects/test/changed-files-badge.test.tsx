import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PROJECTS_SLOTS, PROJECTS_TESTIDS as T } from '../src/contract'
import { ChangedFilesBadge } from '../src/renderer/components/ChangedFilesBadge'
import { withRuntime } from '../src/renderer/lib/runtime'
import { aProject, aWorktree } from './support/builders'
import { mountSidebar, type SidebarHarness } from './support/sidebar-harness'

const project = { ...aProject({ id: 'p', name: 'app' }), sortOrder: 0 }
const worktrees = [aWorktree('p', { id: 'w', branch: 'main', isMain: true }), aWorktree('p', { id: 'x', branch: 'x' })]
const LITERAL_COLOR = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i

const mounted: { h?: SidebarHarness } = {}
afterEach(async () => {
  await mounted.h?.dispose()
  mounted.h = undefined
})

async function mount() {
  const h = await mountSidebar({ projects: [project], worktrees, activeWorktreeId: 'w', changedFiles: { w: 3 } })
  mounted.h = h
  const component = withRuntime(h.runtime, ChangedFilesBadge)
  act(() => void h.host.registries.registerSlot(PROJECTS_SLOTS.worktreeRowBadges, { id: 'b', order: 1, component }))
  return h
}

describe('ChangedFilesBadge', () => {
  it('shows the count as a neutral chip built from theme tokens only', async () => {
    await mount()
    const badge = await screen.findByTestId(T.changedCount)
    expect(badge.textContent).toBe('3')
    expect(badge.getAttribute('aria-label')).toMatch(/3/)
    const classes = badge.className.split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['text-mu', 'bg-el', 'border-bd2']))
    expect(classes).not.toContain('text-warn')
    expect(badge.className).not.toMatch(LITERAL_COLOR)
    expect(badge.getAttribute('style')).toBeNull()
  })

  it('renders nothing for a worktree without changes', async () => {
    await mount()
    await screen.findByTestId(T.changedCount)
    expect(screen.getAllByTestId(T.changedCount)).toHaveLength(1)
  })
})
