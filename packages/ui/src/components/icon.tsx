import * as lucide from 'lucide-react'
import { icons, type LucideIcon } from 'lucide-react'
import { DEFAULT_ICON_PX, FALLBACK_ICON } from '../constants/ui'
import { toPascalCase } from '../lib/utils'

const warned = new Set<string>()
const Fallback = (lucide as unknown as Record<string, LucideIcon>)[FALLBACK_ICON] as LucideIcon

function resolveIcon(name: string): LucideIcon {
  const icon = (icons as Record<string, LucideIcon | undefined>)[toPascalCase(name)]
  if (icon) return icon
  if (!warned.has(name)) {
    warned.add(name)
    console.warn(`[ui] unknown icon "${name}"`)
  }
  return Fallback
}

/** Draws a lucide icon by kebab-case name (the `icon` field of tabs, views and settings pages, §10.4). */
export function Icon({ name, size = DEFAULT_ICON_PX, className }: { name: string; size?: number; className?: string }) {
  const Component = resolveIcon(name)
  return <Component size={size} className={className} aria-hidden />
}
