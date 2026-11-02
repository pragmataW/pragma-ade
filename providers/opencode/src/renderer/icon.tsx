import type { ProviderIconProps } from '@pragma/sdk'
import { DEFAULT_MONOGRAM_PX } from '@pragma/ui/constants/ui'
import { cn } from '@pragma/ui/lib/utils'
import { PROVIDER_ID } from '../constants'

/**
 * The official OpenCode mark, from anomalyco/opencode `packages/identity/mark.svg` (dark) and
 * `mark-light.svg` (light): same shapes, the theme picks the variant's colours. See THIRD_PARTY_NOTICES.md.
 */
const TILE_PATH = 'M0 0H512V512H0Z'
const INNER_PATH = 'M320 224V352H192V224H320Z'
const FRAME_PATH = 'M384 416H128V96H384V416ZM320 160H192V352H320V160Z'

export default function ProviderIcon({ size = DEFAULT_MONOGRAM_PX, className }: ProviderIconProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-hidden rounded-[var(--radius-chip)]', className)}
      data-mark={PROVIDER_ID}
      aria-hidden
    >
      <path d={TILE_PATH} className="fill-[#FDFCFC] dark:fill-[#131010]" />
      <path d={INNER_PATH} className="fill-[#E6E5E6] dark:fill-[#5A5858]" />
      <path d={FRAME_PATH} fillRule="evenodd" className="fill-[#17181C] dark:fill-white" />
    </svg>
  )
}
