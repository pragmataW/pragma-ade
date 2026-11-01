import { useT } from '@pragma/sdk/renderer'
import { Switch } from '@pragma/ui/components/switch'
import { useSyncExternalStore } from 'react'
import { COMMENTS_SETTINGS_DEFAULTS, type CommentsSettings, COMMENTS_TESTIDS as T } from '../../contract'
import { runtime } from '../runtime'

function useCommentsSettings(): CommentsSettings {
  const { settings } = runtime()
  const value = useSyncExternalStore(
    (cb) => {
      const sub = settings.subscribe(cb)
      return () => sub.dispose()
    },
    () => settings.get(),
  )
  return { ...COMMENTS_SETTINGS_DEFAULTS, ...value }
}

/** Settings › Comments: "Press Enter after sending comments" (default off). */
export function CommentsSettingsPage() {
  const t = useT()
  const { submitAfterPaste } = useCommentsSettings()
  const update = (next: boolean) =>
    runtime()
      .settings.update({ submitAfterPaste: next })
      .catch((e: unknown) => console.warn('comments: settings update failed', e))
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <div className="flex items-center justify-between gap-6 rounded-lg border px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-[13px]">{t('comments:settings.submitAfterPaste')}</span>
          <span className="text-[12px] text-muted-foreground">{t('comments:settings.submitAfterPasteHint')}</span>
        </div>
        <Switch
          data-testid={T.submitAfterPasteSwitch}
          aria-label={t('comments:settings.submitAfterPaste')}
          checked={submitAfterPaste}
          onCheckedChange={(v) => void update(v)}
        />
      </div>
    </div>
  )
}
