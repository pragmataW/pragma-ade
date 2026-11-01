import { LOCAL_HOSTS } from '../../constants'
import type { BrowserTabState } from '../../contract'

/** `host:port` of a tab showing a local dev server without a load error; null otherwise. */
export function devUrlLabel(tab: BrowserTabState | null): string | null {
  if (!tab || tab.loadError) return null
  try {
    const url = new URL(tab.url)
    return (LOCAL_HOSTS as readonly string[]).includes(url.hostname) ? url.host : null
  } catch {
    return null
  }
}
