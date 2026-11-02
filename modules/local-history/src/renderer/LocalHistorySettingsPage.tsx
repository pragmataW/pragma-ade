import { useModuleSettings, useRendererContext, useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Input } from '@pragma/ui/components/input'
import { RETENTION } from '../constants'
import { LocalHistoryIpc, type LocalHistorySettings, LOCAL_HISTORY_TESTIDS as T } from '../contract'

const DAYS_ID = 'local-history-days'
const SIZE_ID = 'local-history-size'

function NumberField(props: {
  id: string
  testId: string
  label: string
  hint: string
  value: number
  min: number
  max: number
  onChange(n: number): void
}) {
  return (
    <div className="flex max-w-[420px] flex-col gap-1.5">
      <label htmlFor={props.id}>{props.label}</label>
      <Input
        id={props.id}
        data-testid={props.testId}
        type="number"
        min={props.min}
        max={props.max}
        value={props.value}
        onChange={(e) => {
          const n = e.target.valueAsNumber
          if (Number.isInteger(n) && n >= props.min && n <= props.max) props.onChange(n)
        }}
      />
      <p className="text-[var(--mu)] text-xs">{props.hint}</p>
    </div>
  )
}

export function LocalHistorySettingsPage() {
  const t = useT()
  const ctx = useRendererContext<LocalHistorySettings>()
  const { retentionDays, maxTotalMb } = useModuleSettings<LocalHistorySettings>()
  const clear = async () => {
    const ok = await ctx.dialogs.confirm({
      titleKey: 'local-history:confirm.clearTitle',
      messageKey: 'local-history:confirm.clearMessage',
      confirmKey: 'local-history:confirm.clearConfirm',
      destructive: true,
    })
    if (ok) await ctx.ipc.invoke(LocalHistoryIpc.clear, undefined)
  }
  return (
    <div className="flex flex-col gap-5">
      <NumberField
        id={DAYS_ID}
        testId={T.retentionDays}
        label={t('local-history:settings.retentionDays')}
        hint={t('local-history:settings.retentionHint')}
        value={retentionDays}
        min={RETENTION.minDays}
        max={RETENTION.maxDays}
        onChange={(n) => void ctx.settings.update({ retentionDays: n })}
      />
      <NumberField
        id={SIZE_ID}
        testId={T.maxTotalMb}
        label={t('local-history:settings.maxTotalMb')}
        hint={t('local-history:settings.maxTotalHint')}
        value={maxTotalMb}
        min={RETENTION.minMb}
        max={RETENTION.maxMb}
        onChange={(n) => void ctx.settings.update({ maxTotalMb: n })}
      />
      <Button data-testid={T.clear} variant="destructive" className="self-start" onClick={() => void clear()}>
        {t('local-history:settings.clear')}
      </Button>
    </div>
  )
}
