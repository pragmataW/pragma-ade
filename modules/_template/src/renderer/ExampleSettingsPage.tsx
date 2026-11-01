import { useModuleSettings, useRendererContext, useT } from '@pragma/sdk/renderer'
import { Input } from '@pragma/ui/components/input'
import { type ExampleSettings, TEST_IDS } from '../contract'

const NAME_INPUT_ID = 'example-name'

export function ExampleSettingsPage() {
  const t = useT()
  const ctx = useRendererContext<ExampleSettings>()
  const { name } = useModuleSettings<ExampleSettings>()
  return (
    <div className="flex max-w-[420px] flex-col gap-1.5">
      <label htmlFor={NAME_INPUT_ID}>{t('example:settings.name')}</label>
      <Input
        id={NAME_INPUT_ID}
        data-testid={TEST_IDS.nameInput}
        value={name}
        onChange={(e) => void ctx.settings.update({ name: e.target.value })}
      />
      <p className="text-[var(--mu)] text-xs">{t('example:settings.nameHint')}</p>
    </div>
  )
}
