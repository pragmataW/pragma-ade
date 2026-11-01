import { withOverlayGuard } from '../lib/overlay-guard'
import {
  DropdownMenuContent as VendorDropdownMenuContent,
  DropdownMenuSubContent as VendorDropdownMenuSubContent,
} from '../vendor/dropdown-menu'

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../vendor/dropdown-menu'

export const DropdownMenuContent = withOverlayGuard(VendorDropdownMenuContent)
export const DropdownMenuSubContent = withOverlayGuard(VendorDropdownMenuSubContent)
