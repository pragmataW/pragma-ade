import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOCK_LAYOUT,
  DOCK_LAYOUT_KEY,
  dockLeads,
  isVerticalDock,
  panelIcon,
  readDockLayout,
  swapSides,
  writeDockLayout,
} from '../src/renderer/lib/dock-layout'

const store = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial))
  return { get: (k: string) => values.get(k), set: (k: string, v: string) => void values.set(k, v), values }
}

describe('dock layout persistence', () => {
  it('defaults to sidebar left, dock right', () => {
    expect(readDockLayout(store())).toEqual(DEFAULT_DOCK_LAYOUT)
  })

  it('round-trips through core.layout', () => {
    const s = store()
    writeDockLayout(s, { sidebarSide: 'right', dockPosition: 'bottom' })
    expect(s.values.has(DOCK_LAYOUT_KEY)).toBe(true)
    expect(readDockLayout(s)).toEqual({ sidebarSide: 'right', dockPosition: 'bottom' })
  })

  it.each(['not json', '{"sidebarSide":"up","dockPosition":"middle"}'])('falls back on %s', (raw) => {
    expect(readDockLayout(store({ [DOCK_LAYOUT_KEY]: raw }))).toEqual(DEFAULT_DOCK_LAYOUT)
  })
})

describe('swapSides', () => {
  it.each([
    [
      { sidebarSide: 'left', dockPosition: 'right' },
      { sidebarSide: 'right', dockPosition: 'left' },
    ],
    [
      { sidebarSide: 'right', dockPosition: 'left' },
      { sidebarSide: 'left', dockPosition: 'right' },
    ],
    [
      { sidebarSide: 'left', dockPosition: 'bottom' },
      { sidebarSide: 'right', dockPosition: 'bottom' },
    ],
  ] as const)('%o → %o', (from, to) => {
    expect(swapSides(from)).toEqual(to)
  })
})

it.each([
  ['left', false, true],
  ['right', false, false],
  ['top', true, true],
  ['bottom', true, false],
] as const)('%s: vertical=%s, leads=%s', (p, vertical, leads) => {
  expect(isVerticalDock(p)).toBe(vertical)
  expect(dockLeads(p)).toBe(leads)
})

it.each([
  ['left', 'panel-left'],
  ['right', 'panel-right'],
  ['top', 'panel-top'],
  ['bottom', 'panel-bottom'],
] as const)('a panel on the %s edge draws the %s icon', (edge, icon) => {
  expect(panelIcon(edge)).toBe(icon)
})
