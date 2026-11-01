import { copyText } from '@pragma/ui/lib/clipboard'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import type { Terminal } from '@xterm/xterm'
import { useCallback, useState } from 'react'
import { terminalIpc } from '../../contract'
import { getRuntime } from '../runtime'
import { classifyKey, KEY_PLATFORM, keyPlatform, TERMINAL_KEY_ACTION, type TerminalKeyAction } from './keymap'

export interface TerminalFeatures {
  /** Installs keys, search and links on a new xterm instance; returns its cleanup. */
  onTerminal(term: Terminal): () => void
  search: SearchAddon | null
  searchOpen: boolean
  closeSearch(): void
  linkHovered: boolean
}

const platform = keyPlatform(globalThis.navigator?.userAgent ?? '')

const withModifier = (e: MouseEvent): boolean => (platform === KEY_PLATFORM.mac ? e.metaKey : e.ctrlKey)

function runAction(action: TerminalKeyAction, term: Terminal, openSearch: () => void): void {
  switch (action) {
    case TERMINAL_KEY_ACTION.copy:
      void copyText(term.getSelection())
      return
    case TERMINAL_KEY_ACTION.paste:
      // term.paste applies the program's bracketed-paste mode
      navigator.clipboard
        .readText()
        .then((text) => term.paste(text))
        .catch(() => undefined)
      return
    case TERMINAL_KEY_ACTION.search:
      openSearch()
      return
    default: {
      const unreachable: never = action
      void unreachable
    }
  }
}

/** Copy/paste/find shortcuts, the find bar's addon, and modifier-click web links. */
export function useTerminalFeatures(): TerminalFeatures {
  const [search, setSearch] = useState<SearchAddon | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [linkHovered, setLinkHovered] = useState(false)
  const onTerminal = useCallback((term: Terminal) => {
    const addon = new SearchAddon()
    term.loadAddon(addon)
    setSearch(addon)
    term.attachCustomKeyEventHandler((e) => {
      const action = classifyKey(e, platform, term.hasSelection())
      if (!action) return true
      e.preventDefault()
      runAction(action, term, () => setSearchOpen(true))
      return false
    })
    const links = new WebLinksAddon(
      (event, url) => {
        if (withModifier(event))
          getRuntime()
            .ipc.invoke(terminalIpc.openLink, { url })
            .catch(() => undefined)
      },
      { hover: () => setLinkHovered(true), leave: () => setLinkHovered(false) },
    )
    term.loadAddon(links)
    return () => {
      setSearch(null)
      setSearchOpen(false)
    }
  }, [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  return { onTerminal, search, searchOpen, closeSearch, linkHovered }
}
