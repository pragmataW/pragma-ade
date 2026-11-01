import { useLatestAsync, useRendererContext, useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { ExampleIpc, TEST_IDS } from '../contract'
import { useExampleGreeting } from './use-example-greeting'

export function ExampleTab() {
  const t = useT()
  const ctx = useRendererContext()
  const greeting = useExampleGreeting()
  const items = useLatestAsync(() => ctx.ipc.invoke(ExampleIpc.countItems, undefined), [ctx])
  const add = async () => {
    const n = (items.data?.count ?? 0) + 1
    await ctx.ipc.invoke(ExampleIpc.addItem, { label: t('example:tab.itemLabel', { n }) })
    items.reload()
  }
  return (
    <div data-testid={TEST_IDS.tabBody} className="flex flex-col gap-2 p-3">
      <p data-testid={TEST_IDS.greeting}>{greeting}</p>
      <p data-testid={TEST_IDS.count} className="text-[var(--mu)] text-xs">
        {t('example:tab.count', { count: items.data?.count ?? 0 })}
      </p>
      <Button data-testid={TEST_IDS.addItem} className="self-start" onClick={() => void add()}>
        {t('example:tab.addItem')}
      </Button>
    </div>
  )
}
