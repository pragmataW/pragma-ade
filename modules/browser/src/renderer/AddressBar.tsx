import { useT } from '@pragma/sdk/renderer'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { BUTTON_TYPE, PORT_ONLY_RE } from '../constants'
import { BrowserIpc, type BrowserTabState, normalizeAddressInput, BROWSER_TEST_IDS as T } from '../contract'
import { devUrlLabel } from './lib/dev-url'
import { send } from './lib/ipc'
import { useBrowserSettings } from './lib/use-settings'
import { useBrowser } from './runtime'

const ENTER = 'Enter'
const ESCAPE = 'Escape'

/** Loads `input` in the tab, or opens a new tab when there is none. */
function go(tab: BrowserTabState | null, input: string, searchUrl: string): void {
  if (tab) {
    void send(BrowserIpc.navigate, { tabId: tab.id, input })
    return
  }
  const target = normalizeAddressInput(input, searchUrl)
  if (target) void send(BrowserIpc.openTab, { url: target.url })
}

/** URL field: Enter loads, Esc restores, a port-only input offers `http://localhost:<port>/`. */
export function AddressBar({ tab }: { tab: BrowserTabState | null }) {
  const t = useT()
  const { searchUrl } = useBrowserSettings()
  const focusTick = useBrowser((s) => s.addressFocusTick)
  const ref = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? tab?.url ?? ''
  const suggestion = draft && PORT_ONLY_RE.test(draft.trim()) ? normalizeAddressInput(draft, searchUrl) : null
  const dev = devUrlLabel(tab)

  useEffect(() => {
    if (focusTick > 0 || !tab) ref.current?.select()
  }, [focusTick, tab])

  const submit = (input: string) => {
    setDraft(null)
    go(tab, input, searchUrl)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ENTER && value.trim()) submit(value)
    else if (e.key === ESCAPE) {
      setDraft(null)
      e.currentTarget.blur()
    }
  }

  return (
    <div className="relative flex h-6 min-w-0 flex-1 items-center rounded-md border border-[var(--bd2)] bg-[var(--el)] px-2 focus-within:border-[var(--ac)]">
      {dev ? (
        <span
          data-testid={T.devServerDot}
          title={t('browser:address.devServer')}
          className="mr-1.5 size-2 shrink-0 rounded-full bg-[var(--ok)]"
        />
      ) : null}
      <input
        ref={ref}
        data-testid={T.addressBar}
        aria-label={t('browser:address.placeholder')}
        placeholder={t('browser:address.placeholder')}
        spellCheck={false}
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setDraft((d) => (d === tab?.url ? null : d))}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-[var(--tx)] outline-none placeholder:text-[var(--fa)]"
      />
      {suggestion ? (
        <button
          type={BUTTON_TYPE}
          data-testid={T.addressSuggestion}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => submit(suggestion.url)}
          className="ml-1 shrink-0 truncate rounded bg-[var(--acs)] px-1.5 text-[11px] text-[var(--act)]"
        >
          {t('browser:address.suggestLocalhost', { url: suggestion.url })}
        </button>
      ) : null}
    </div>
  )
}
