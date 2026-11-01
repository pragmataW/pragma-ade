import { useT } from '@pragma/sdk/renderer'
import { PROBE_TEST_IDS } from '../contract/testids'

export function ProbeSlot() {
  const t = useT()
  return (
    <span data-testid={PROBE_TEST_IDS.slot} className="px-1 text-[var(--mu)] text-xs">
      {t('probe:slot.label')}
    </span>
  )
}
