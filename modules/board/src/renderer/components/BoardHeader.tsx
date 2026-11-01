import { useBoardStore } from '../store'
import { AddColumn } from './AddColumn'
import { BoardFilters } from './BoardFilters'
import { ModeToggle } from './ModeToggle'
import { NewTaskButton } from './NewTaskButton'
import { ScopePicker } from './ScopePicker'
import { SearchInput } from './SearchInput'

/** Board toolbar (ui-notes Screen 5): scope picker, search, filter chips, mode toggle, New task. */
export function BoardHeader() {
  const filterVersion = useBoardStore((s) => s.filterVersion)
  return (
    <header className="flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b border-[var(--bd)] bg-[var(--pn)] px-3 py-1">
      <ScopePicker />
      <SearchInput key={filterVersion} />
      <BoardFilters />
      <div className="ml-auto flex items-center gap-2">
        <ModeToggle />
        <AddColumn />
        <NewTaskButton />
      </div>
    </header>
  )
}
