import { useRendererHost } from './context'

/** The provider module's icon component (a monogram by default, §10.1.9). */
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
