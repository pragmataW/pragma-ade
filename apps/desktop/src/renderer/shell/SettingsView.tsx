import { ShellTestIds as T } from '@pragma/sdk'
import { ErrorBoundary, useRendererHost, useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import { cn } from '@pragma/ui/lib/utils'
import { useStore } from 'zustand'
import { NAV_ICON_PX } from '../constants'
import { useShell, useShellStore } from '../lib/shell-context'
import { EmptyState } from './EmptyState'
import { PlainButton } from './PlainButton'

/** Settings replace center + right dock: 220px nav ordered by SETTINGS_PAGE_ORDER, then the page (ui-notes 6b/6c). */
export function SettingsView() {
  const t = useT()
  const host = useRendererHost()
  const store = useShellStore()
  const pages = useStore(host.registries.store, (s) => s.settingsPages)
  const requested = useShell((s) => s.settingsPage)
  const page = pages.find((p) => p.id === requested) ?? pages[0]
  return (
    <div data-testid={T.settingsView} className="flex h-full bg-[var(--bg)]">
      <aside className="flex w-[var(--settings-nav-w)] shrink-0 flex-col gap-0.5 border-r border-[var(--bd)] bg-[var(--sb)] p-2">
        <PlainButton
          data-testid={T.settingsBack}
          onClick={() => store.setState({ settingsOpen: false })}
          className="mb-2 flex h-[var(--row-h)] items-center gap-1.5 rounded-[var(--radius-button)] px-2 text-[var(--mu)] hover:bg-[var(--hv)]"
        >
          <Icon name="arrow-left" size={NAV_ICON_PX} />
          {t('core:settings.back')}
        </PlainButton>
        {pages.map((p) => (
          <PlainButton
            key={p.id}
            data-testid={T.settingsNav(p.id)}
            aria-current={p.id === page?.id ? 'page' : undefined}
            onClick={() => store.setState({ settingsPage: p.id })}
            className={cn(
              'flex h-[var(--row-h)] items-center gap-2 rounded-[var(--radius-button)] px-2 text-left hover:bg-[var(--hv)]',
              p.id === page?.id && 'bg-[var(--hv)] text-[var(--tx)]',
            )}
          >
            {p.icon && <Icon name={p.icon} size={NAV_ICON_PX} />}
            {t(p.titleKey)}
          </PlainButton>
        ))}
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6">
        {page ? (
          <section data-testid={T.settingsPage(page.id)}>
            <h1 className="mb-4 font-semibold text-[20px]">{t(page.titleKey)}</h1>
            <ErrorBoundary key={page.id} name={`settings ${page.id}`}>
              <page.component />
            </ErrorBoundary>
          </section>
        ) : (
          <EmptyState textKey="core:settings.empty" testId={T.settingsPage('none')} />
        )}
      </main>
    </div>
  )
}
