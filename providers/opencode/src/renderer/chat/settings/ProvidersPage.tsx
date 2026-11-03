import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { Input } from '@pragma/ui/components/input'
import { ChevronRight, Info, Plug, Search, Sparkles, Trash2 } from '@pragma/ui/icons'
import { useCallback, useMemo, useState } from 'react'
import { CONNECTION_OPS as OP, type ProviderConnection } from '../connections'
import {
  BUTTON_TYPE,
  CONNECTIONS_I18N as C,
  ICON_PX,
  ICON_STROKE,
  OPENCODE_CHAT_TESTIDS as IDS,
  MAX_AVAILABLE_ROWS,
  ROLE,
  SIZE_ICON_XS,
  VARIANT_GHOST,
} from '../constants'
import { type ChatProviderSettingsProps, useChatHost } from '../kit'
import { ConnectPanel } from './ConnectPanel'
import { type Call, messageOf, useConnections } from './use-connections'

const isConnected = (p: ProviderConnection) => p.credentials.length > 0 || p.env.length > 0

function StatusPill({ p }: { p: ProviderConnection }) {
  const t = useT()
  const [label, tone] = isConnected(p)
    ? [p.credentials[0]?.label ?? t(C.env, { name: p.env[0] }), 'border-ok/40 bg-ok/10 text-ok']
    : p.free
      ? [t(C.free), 'border-act/40 bg-act/10 text-act']
      : [t(C.notConnected), 'border-bd text-mu']
  return (
    <span
      className={cn('inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[11px] font-medium', tone)}
    >
      {label}
    </span>
  )
}

function ProviderRow({ p, call, onChange }: { p: ProviderConnection; call: Call; onChange(): void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const host = useChatHost()
  const remove = async ({ id: credentialID, label }: ProviderConnection['credentials'][number]) => {
    const params = { label, name: p.name }
    const ok = await host.confirm({
      titleKey: C.removeTitle,
      messageKey: C.removeMessage,
      confirmKey: C.removeConfirm,
      params,
      destructive: true,
    })
    if (!ok) return
    try {
      await call({ op: OP.remove, credentialID })
      onChange()
    } catch (e) {
      setError(messageOf(e))
    }
  }
  const connectable = p.key || p.oauth.length > 0
  return (
    <li data-testid={IDS.providerRow(p.id)} className="flex flex-col gap-2 px-3 py-2">
      <div className="flex min-h-7 items-center gap-2">
        <button
          type={BUTTON_TYPE}
          aria-expanded={open}
          data-testid={IDS.providerConnect(p.id)}
          disabled={!connectable}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-default"
        >
          <ChevronRight
            size={ICON_PX}
            strokeWidth={ICON_STROKE}
            aria-hidden
            className={cn('shrink-0 text-mu transition-transform', open && 'rotate-90', !connectable && 'opacity-0')}
          />
          <span className="truncate text-[13px] font-medium text-tx">{p.name}</span>
          <span className="truncate font-mono text-[11px] text-fa">{p.id}</span>
        </button>
        <StatusPill p={p} />
        {p.credentials.map((c) => (
          <Button
            key={c.id}
            variant={VARIANT_GHOST}
            size={SIZE_ICON_XS}
            data-testid={IDS.providerRemove(c.id)}
            aria-label={t(C.remove, { label: c.label })}
            title={t(C.remove, { label: c.label })}
            onClick={() => void remove(c)}
            className="size-6 text-mu hover:text-err"
          >
            <Trash2 size={ICON_PX} strokeWidth={ICON_STROKE} />
          </Button>
        ))}
      </div>
      {p.notice ? (
        <p className="flex items-start gap-1.5 pl-6 text-[12px] text-warn">
          <Info size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="mt-0.5 shrink-0" />
          {t(`${C.noticePrefix}${p.notice}`)}
        </p>
      ) : null}
      {error ? <span className="pl-6 text-[12px] text-err">{error}</span> : null}
      {open ? (
        <div className="pl-6">
          <ConnectPanel
            provider={p}
            call={call}
            onConnected={() => {
              setOpen(false)
              onChange()
            }}
          />
        </div>
      ) : null}
    </li>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Plug; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-[0.06em] text-mu uppercase">
        <Icon size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
        {title}
      </h3>
      <ul className="divide-y divide-bd overflow-hidden rounded-lg border border-bd bg-el">{children}</ul>
    </section>
  )
}

/**
 * Settings › OpenCode: the model providers OpenCode can use. Connected ones (saved credential or env variable) first,
 * then the rest, searchable; each connects by API key or sign-in and its credentials can be removed.
 */
export function ProvidersPage({ call: rawCall }: ChatProviderSettingsProps) {
  const t = useT()
  const call = useCallback<Call>((r) => rawCall(r), [rawCall])
  const { list, error, reload } = useConnections(call)
  const [query, setQuery] = useState('')
  const { connected, available, hidden } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = (list?.providers ?? []).filter((p) => !q || `${p.name} ${p.id}`.toLowerCase().includes(q))
    const rest = all.filter((p) => !isConnected(p))
    return {
      connected: all.filter(isConnected),
      available: rest.slice(0, MAX_AVAILABLE_ROWS),
      hidden: Math.max(0, rest.length - MAX_AVAILABLE_ROWS),
    }
  }, [list, query])
  const row = (p: ProviderConnection) => <ProviderRow key={p.id} p={p} call={call} onChange={() => void reload()} />
  return (
    <div data-testid={IDS.providers} className="flex max-w-3xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-tx">{t(C.heading)}</h2>
        <p className="text-[12.5px] text-mu">{t(C.intro)}</p>
      </header>
      <div className="relative">
        <Search
          size={ICON_PX}
          strokeWidth={ICON_STROKE}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-mu"
        />
        <Input
          data-testid={IDS.providerSearch}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(C.search)}
          aria-label={t(C.search)}
          className="h-8 pl-8 text-[12.5px]"
        />
      </div>
      {error ? (
        <p
          role={ROLE.alert}
          data-testid={IDS.providerError}
          className="rounded-md border border-err/40 px-3 py-2 text-[12.5px] text-err"
        >
          {t(C.loadFailed, { message: error })}
        </p>
      ) : null}
      {!list && !error ? <p className="text-[12.5px] text-mu">{t(C.loading)}</p> : null}
      {connected.length > 0 ? (
        <Section title={t(C.connected)} icon={Plug}>
          {connected.map(row)}
        </Section>
      ) : null}
      {available.length > 0 ? (
        <Section title={t(C.available)} icon={Sparkles}>
          {available.map(row)}
        </Section>
      ) : null}
      {hidden > 0 ? <p className="px-1 text-[12px] text-fa">{t(C.more, { count: hidden })}</p> : null}
    </div>
  )
}
