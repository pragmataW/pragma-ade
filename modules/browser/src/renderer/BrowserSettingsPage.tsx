import { useT } from '@pragma/sdk/renderer'
import { Input } from '@pragma/ui/components/input'
import { Switch } from '@pragma/ui/components/switch'
import { type ReactNode, useState } from 'react'
import { type BrowserSettings, BrowserSettingsSchema, BROWSER_TEST_IDS as T } from '../contract'
import { useBrowserSettings } from './lib/use-settings'
import { runtime } from './runtime'

const NUMBER_FIELDS = [
  'consoleBufferSize',
  'consoleErrorsInComment',
  'maxLiveViews',
  'screenshotRetentionDays',
] as const
type NumberField = (typeof NUMBER_FIELDS)[number]
const SEARCH_URL_ID = 'browser-setting-searchUrl'
const REACT_PROBE_ID = 'browser-setting-reactProbe'

const update = (patch: Partial<BrowserSettings>) =>
  runtime()
    .ctx.settings.update(patch)
    .catch((error: unknown) => console.warn('browser: saving settings failed', error))

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--bd)] py-2.5">
      <label htmlFor={htmlFor} className="text-[13px] text-[var(--tx)]">
        {label}
      </label>
      {children}
    </div>
  )
}

function NumberInput({ field, value }: { field: NumberField; value: number }) {
  const t = useT()
  const [draft, setDraft] = useState(String(value))
  const valid = BrowserSettingsSchema.shape[field].safeParse(Number(draft)).success
  const id = `browser-setting-${field}`
  return (
    <Field label={t(`browser:settings.${field}`)} htmlFor={id}>
      <Input
        id={id}
        type="number"
        data-testid={`${T.settingsPage}-${field}`}
        aria-invalid={!valid}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = BrowserSettingsSchema.shape[field].safeParse(Number(e.target.value))
          if (e.target.value !== '' && parsed.success) void update({ [field]: parsed.data })
        }}
        className="w-24 text-right"
      />
    </Field>
  )
}

/** Settings › Browser (order 90). */
export function BrowserSettingsPage() {
  const t = useT()
  const s = useBrowserSettings()
  const [searchUrl, setSearchUrl] = useState(s.searchUrl)
  return (
    <div data-testid={T.settingsPage} className="flex max-w-[640px] flex-col">
      <Field label={t('browser:settings.searchUrl')} htmlFor={SEARCH_URL_ID}>
        <Input
          id={SEARCH_URL_ID}
          value={searchUrl}
          onChange={(e) => setSearchUrl(e.target.value)}
          onBlur={() => searchUrl.trim() && void update({ searchUrl: searchUrl.trim() })}
          className="w-[320px] font-mono text-[12px]"
        />
      </Field>
      {NUMBER_FIELDS.map((field) => (
        <NumberInput key={field} field={field} value={s[field]} />
      ))}
      <Field label={t('browser:settings.reactProbe')} htmlFor={REACT_PROBE_ID}>
        <Switch
          id={REACT_PROBE_ID}
          checked={s.reactProbe}
          onCheckedChange={(reactProbe) => void update({ reactProbe })}
        />
      </Field>
    </div>
  )
}
