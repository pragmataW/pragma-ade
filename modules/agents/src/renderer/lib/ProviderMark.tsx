import { Icon } from '@pragma/ui/components/icon'
import { FALLBACK_MARK_ICON } from '../../constants'
import { getRuntime } from '../runtime'

/** The provider's monogram icon (§10.1.9), falling back to a generic mark. */
export function ProviderMark({ providerId, size }: { providerId: string; size: number }) {
  const Mark = getRuntime().ctx.providers.icon(providerId)
  return Mark ? <Mark size={size} /> : <Icon name={FALLBACK_MARK_ICON} size={size} />
}
