import { useRendererHost } from './context'

/** The provider module's icon component (its official logo, or a monogram when it has none). */
export function ProviderIcon({
  providerId,
  size,
  className,
}: {
  providerId: string
  size?: number
  className?: string
}) {
  const Icon = useRendererHost().providers.icon(providerId)
  return Icon ? <Icon size={size} className={className} /> : null
}
