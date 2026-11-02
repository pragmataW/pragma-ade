import { useSyncExternalStore } from 'react'
import { DEFAULT_ICON_PX } from '../constants/ui'
import { fileIconName, folderIconName, iconFileName } from '../lib/file-icons'
import { cn } from '../lib/utils'

/** Every Material Icon Theme SVG as a served file (`no-inline`: never base64 in the bundle). */
const ICON_URLS = import.meta.glob<string>('../../node_modules/material-icon-theme/icons/*.svg', {
  eager: true,
  query: '?url&no-inline',
  import: 'default',
})
const urlByFile = new Map(Object.entries(ICON_URLS).map(([path, url]) => [path.split('/').pop() ?? path, url]))

const THEME_ATTRIBUTE = 'data-theme'
const LIGHT = 'light'

/** Follows the shell's resolved theme (`<html data-theme>`), so light-only icon variants switch with it. */
function subscribeTheme(cb: () => void): () => void {
  const observer = new MutationObserver(cb)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [THEME_ATTRIBUTE] })
  return () => observer.disconnect()
}
const isLightTheme = (): boolean => document.documentElement.getAttribute(THEME_ATTRIBUTE) === LIGHT
const useLightTheme = (): boolean => useSyncExternalStore(subscribeTheme, isLightTheme, () => false)

export function iconUrl(icon: string): string | undefined {
  const file = iconFileName(icon)
  return file ? urlByFile.get(file) : undefined
}

/** A file or folder icon from Material Icon Theme (the same icons the editor's explorer shows). */
export function FileIcon({
  path,
  folder = false,
  open = false,
  size = DEFAULT_ICON_PX,
  className,
}: {
  path: string
  folder?: boolean
  open?: boolean
  size?: number
  className?: string
}) {
  const light = useLightTheme()
  const icon = folder ? folderIconName(path, { open, light }) : fileIconName(path, { light })
  return (
    <img
      src={iconUrl(icon)}
      data-icon={icon}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={cn('shrink-0', className)}
    />
  )
}
