import { NewTaskButton } from './NewTaskButton'
import { ScopePicker } from './ScopePicker'

/** Board toolbar (ui-notes Screen 5): scope picker, search, filter chips, mode toggle, New task. */
export function BoardHeader() {
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--bd)] bg-[var(--pn)] px-3">
      <ScopePicker />
      <div className="ml-auto flex items-center gap-2">
        <NewTaskButton />
      </div>
    </header>
  )
}
