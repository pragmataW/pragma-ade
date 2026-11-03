import { z } from '@pragma/sdk'
import type { LayoutStore } from '@pragma/sdk/runtime/renderer'

export const DOCK_POSITIONS = ['left', 'right', 'top', 'bottom'] as const
export type DockPosition = (typeof DOCK_POSITIONS)[number]
export const SIDEBAR_SIDES = ['left', 'right'] as const
export type SidebarSide = (typeof SIDEBAR_SIDES)[number]

export const DOCK = { left: 'left', right: 'right', top: 'top', bottom: 'bottom' } as const satisfies Record<
  string,
  DockPosition
>

export const DEFAULT_DOCK_LAYOUT = { sidebarSide: DOCK.left, dockPosition: DOCK.right } as const

/** Where the sidebar and the dock (the right panel's tabs) sit; anything unreadable falls back to the default. */
export const DockLayoutSchema = z.object({
  sidebarSide: z.enum(SIDEBAR_SIDES).catch(DEFAULT_DOCK_LAYOUT.sidebarSide),
  dockPosition: z.enum(DOCK_POSITIONS).catch(DEFAULT_DOCK_LAYOUT.dockPosition),
})
export type DockLayout = z.infer<typeof DockLayoutSchema>

/** Kept with the pane sizes in `core.layout`. */
export const DOCK_LAYOUT_KEY = 'shell.dock'

export function readDockLayout(layout: Pick<LayoutStore, 'get'>): DockLayout {
  const raw = layout.get(DOCK_LAYOUT_KEY)
  if (!raw) return { ...DEFAULT_DOCK_LAYOUT }
  try {
    return DockLayoutSchema.parse(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_DOCK_LAYOUT }
  }
}

export function writeDockLayout(layout: Pick<LayoutStore, 'set'>, value: DockLayout): void {
  layout.set(DOCK_LAYOUT_KEY, JSON.stringify(value))
}

const opposite = <S extends SidebarSide>(side: S): SidebarSide => (side === DOCK.left ? DOCK.right : DOCK.left)

/** Swaps the side panels: the sidebar changes side, and a side-docked panel takes the sidebar's old side. */
export function swapSides(l: DockLayout): DockLayout {
  const vertical = l.dockPosition === DOCK.top || l.dockPosition === DOCK.bottom
  return {
    sidebarSide: opposite(l.sidebarSide),
    dockPosition: vertical ? l.dockPosition : opposite(l.dockPosition as SidebarSide),
  }
}

export const isVerticalDock = (p: DockPosition): boolean => p === DOCK.top || p === DOCK.bottom
/** The dock comes before the center (left of it, or above it). */
export const dockLeads = (p: DockPosition): boolean => p === DOCK.left || p === DOCK.top

/** The lucide panel icon for a panel on `edge`, so toggles draw the panel where it actually sits. */
export const panelIcon = (edge: DockPosition | SidebarSide): string => `panel-${edge}`

const DockPositionSchema = z.enum(DOCK_POSITIONS)
/** A drop target id (dnd-kit `over.id`) as the dock position it stands for, or `null` for anything else. */
export function asDockPosition(id: unknown): DockPosition | null {
  const parsed = DockPositionSchema.safeParse(id)
  return parsed.success ? parsed.data : null
}
