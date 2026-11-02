import { useT } from '@pragma/sdk/renderer'
import { Input } from '@pragma/ui/components/input'
import { Switch } from '@pragma/ui/components/switch'
import { type ReactNode, useEffect, useState } from 'react'
import {
  EditorIpc,
  type EditorServerInfo,
  type EditorSettings,
  EditorSettingsSchema,
  MAX_OPEN_VIEWS_MAX,
  MAX_OPEN_VIEWS_MIN,
  EDITOR_TEST_IDS as T,
  type ThemeMode,
} from '../contract'
import { ActionButton } from './ActionButton'
import { useEditorSettings, useEditorStatus } from './hooks'
import { editorRuntime } from './runtime'

const ROW =
  'grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[var(--bd)] py-2.5 text-[13px] text-[var(--tx)]'

async function update(patch: Partial<EditorSettings>): Promise<void> {
  try {
    await editorRuntime().ctx.settings.update(patch)
  } catch (error) {
    console.warn('editor: saving settings failed', error)
  }
}

function Field(p: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className={ROW}>
      <label htmlFor={p.htmlFor}>{p.label}</label>
      {p.children}
    </div>
  )
}

function MaxViews({ value }: { value: number }) {
  const t = useT()
  const [draft, setDraft] = useState(String(value))
  const schema = EditorSettingsSchema.shape.maxOpenViews
  return (
    <Field label={t('editor:settings.maxOpenViews')} htmlFor={T.maxOpenViews}>
      <Input
        id={T.maxOpenViews}
        data-testid={T.maxOpenViews}
        type="number"
        min={MAX_OPEN_VIEWS_MIN}
        max={MAX_OPEN_VIEWS_MAX}
        aria-invalid={!schema.safeParse(Number(draft)).success}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          const parsed = schema.safeParse(Number(e.target.value))
          if (e.target.value !== '' && parsed.success) void update({ maxOpenViews: parsed.data })
        }}
        className="w-20 text-right"
      />
    </Field>
  )
}

function ThemeName({ mode, id, value, label }: { mode: ThemeMode; id: string; value: string; label: string }) {
  const [draft, setDraft] = useState(value)
  const map = useEditorSettings().themeMap
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        data-testid={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() && void update({ themeMap: { ...map, [mode]: draft.trim() } })}
        className="w-[220px] text-[12.5px]"
      />
    </Field>
  )
}

function Toggle({ field, id, label }: { field: 'syncPalette' | 'serveWebviewsLocally'; id: string; label: string }) {
  const s = useEditorSettings()
  return (
    <Field label={label} htmlFor={id}>
      <Switch id={id} data-testid={id} checked={s[field]} onCheckedChange={(v) => void update({ [field]: v })} />
    </Field>
  )
}

function ServerInfo() {
  const t = useT()
  const status = useEditorStatus()
  const [info, setInfo] = useState<EditorServerInfo | null>(null)
  const { ipc } = editorRuntime().ctx
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh when the status changes
  useEffect(() => {
    void ipc.invoke(EditorIpc.getServerInfo, {}).then(setInfo)
  }, [status?.state])
  return (
    <div data-testid={T.serverInfo} className="flex flex-col gap-2 py-3 text-[12.5px] text-[var(--mu)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em]">{t('editor:settings.server')}</div>
      <div>
        {t('editor:settings.version')}: <span className="font-mono">{info?.version ?? '—'}</span>
      </div>
      <div>
        {t('editor:settings.port')}: <span className="font-mono">{info?.port ?? t('editor:settings.notRunning')}</span>
      </div>
      <div className="flex gap-2">
        <ActionButton testId={T.restartServer} secondary onClick={() => void ipc.invoke(EditorIpc.restartServer, {})}>
          {t('editor:settings.restart')}
        </ActionButton>
        <ActionButton testId={T.redownload} secondary onClick={() => void ipc.invoke(EditorIpc.reinstall, {})}>
          {t('editor:settings.reinstall')}
        </ActionButton>
      </div>
    </div>
  )
}

/** Settings › Editor (order 80). Global shortcuts are listed by the SDK's own page. */
export function EditorSettingsPage() {
  const t = useT()
  const s = useEditorSettings()
  return (
    <div data-testid={T.settingsPage} className="flex max-w-[640px] flex-col">
      <MaxViews value={s.maxOpenViews} />
      <ThemeName mode="dark" id={T.themeDark} value={s.themeMap.dark} label={t('editor:settings.themeDark')} />
      <ThemeName mode="light" id={T.themeLight} value={s.themeMap.light} label={t('editor:settings.themeLight')} />
      <Toggle field="syncPalette" id={T.syncPalette} label={t('editor:settings.syncPalette')} />
      <Toggle
        field="serveWebviewsLocally"
        id={T.serveWebviewsLocally}
        label={t('editor:settings.serveWebviewsLocally')}
      />
      <ServerInfo />
    </div>
  )
}
