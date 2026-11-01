import { withOverlayGuard } from '../lib/overlay-guard'
import { DialogContent as VendorDialogContent } from '../vendor/dialog'

export {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from '../vendor/dialog'

/** Overlay-guarded; the vendor's untranslated close button is off by default (callers render their own). */
export const DialogContent = withOverlayGuard(VendorDialogContent, { showCloseButton: false })
