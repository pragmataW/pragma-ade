import { withOverlayGuard } from '../lib/overlay-guard'
import { PopoverContent as VendorPopoverContent } from '../vendor/popover'

export {
  Popover,
  PopoverAnchor,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '../vendor/popover'

/** Overlay-guarded; pass `guardMode="snapshot"` to sit over a frozen native-view image. */
export const PopoverContent = withOverlayGuard(VendorPopoverContent)
