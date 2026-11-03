import { ShellSlots } from '@pragma/sdk'
import { Slot } from '@pragma/sdk/renderer'

/** 24px status bar; owners register their items into the left/right slots (§10.3). */
export function StatusBar() {
  return (
    <footer className="app-statusbar flex h-[var(--statusbar-h)] shrink-0 items-center justify-between gap-3 border-t border-[var(--bd)] bg-[var(--sb)] px-2 text-[11px] text-[var(--mu)]">
      <div className="flex items-center gap-3">
        <Slot id={ShellSlots.statusbarLeft} />
      </div>
      <div className="flex items-center gap-3">
        <Slot id={ShellSlots.statusbarRight} />
      </div>
    </footer>
  )
}
