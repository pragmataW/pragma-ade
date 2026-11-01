import type { ComponentProps } from 'react'
import { withOverlayGuard } from '../lib/overlay-guard'
import { CommandDialog as VendorCommandDialog } from '../vendor/command'

export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../vendor/command'

const GuardedCommandDialog = withOverlayGuard(VendorCommandDialog, { showCloseButton: false })

/** Overlay-guarded command dialog; `title` and `description` are required (translated by the caller). */
export function CommandDialog(
  props: ComponentProps<typeof GuardedCommandDialog> & { title: string; description: string },
) {
  return <GuardedCommandDialog {...props} />
}
