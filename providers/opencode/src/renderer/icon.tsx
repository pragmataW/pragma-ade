import type { ProviderIconProps } from '@pragma/sdk'
import { Monogram } from '@pragma/ui/components/monogram'
import { MONOGRAM } from '../constants'

export default function ProviderIcon(props: ProviderIconProps) {
  return <Monogram letters={MONOGRAM} {...props} />
}
