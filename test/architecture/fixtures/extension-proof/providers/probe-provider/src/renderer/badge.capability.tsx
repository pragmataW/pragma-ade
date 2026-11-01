import { defineRendererCapability } from '@pragma/sdk'
import { useT } from '@pragma/sdk/renderer'
import { PROVIDER_ID } from '../constants'

function ProbeBadge() {
  const t = useT()
  return (
    <span className="rounded-[var(--radius-chip)] bg-[var(--acs)] px-1.5 text-xs">
      {t('probe-provider:badge.label')}
    </span>
  )
}

export default defineRendererCapability(PROVIDER_ID, 'badge', { Badge: ProbeBadge })
