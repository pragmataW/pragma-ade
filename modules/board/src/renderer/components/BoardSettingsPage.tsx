import { useModuleSettings, useRendererContext, useT } from '@pragma/sdk/renderer'
import { Switch } from '@pragma/ui/components/switch'
import { type BoardSettings, BOARD_TESTIDS as T } from '../../contract'

const ROWS = [
  { key: 'sendPromptByDefault', testId: T.settingsSendPrompt, labelKey: 'board:settings.sendPromptByDefault' },
  {
    key: 'moveToInProgressOnStart',
    testId: T.settingsMoveToInProgress,
    labelKey: 'board:settings.moveToInProgressOnStart',
  },
] as const

/** Settings › Task Board: start-flow defaults. */
export function BoardSettingsPage() {
  const t = useT()
  const ctx = useRendererContext<BoardSettings>()
  const settings = useModuleSettings<BoardSettings>()
  return (
    <div className="flex max-w-xl flex-col">
      {ROWS.map((r) => (
        <div
          key={r.key}
          className="flex items-center justify-between gap-4 border-b border-[var(--bd)] py-2.5 text-[13px]"
        >
          <span>{t(r.labelKey)}</span>
          <Switch
            data-testid={r.testId}
            aria-label={t(r.labelKey)}
            checked={settings[r.key]}
            onCheckedChange={(v) =>
              void ctx.settings.update({ [r.key]: v }).catch((e: unknown) => console.warn('board: settings', e))
            }
          />
        </div>
      ))}
    </div>
  )
}
