import { MODAL_COVER, withOverlayGuard } from '../lib/overlay-guard'
import { SheetContent as VendorSheetContent } from '../vendor/sheet'

export {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../vendor/sheet'

/** Overlay-guarded; the vendor's untranslated close button is off by default. */
export const SheetContent = withOverlayGuard(VendorSheetContent, { showCloseButton: false }, MODAL_COVER)
