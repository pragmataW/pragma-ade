import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { Ellipsis } from '@pragma/ui/icons'
import { DIFF_ICON_PX, SIZE_ICON_SM, VARIANT_GHOST } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'

/** One menu command: `id` names its test id, `labelKey` its i18n label. */
export interface MenuEntry {
  id: string
  labelKey: string
  run(): void
  disabled?: boolean
}
export interface MenuGroup {
  id: string
  labelKey: string
  items: MenuEntry[]
}

const ALIGN_END = 'end'

function Entry({ entry }: { entry: MenuEntry }) {
  const t = useT()
  return (
    <DropdownMenuItem data-testid={T.scmMenuItem(entry.id)} disabled={entry.disabled} onSelect={entry.run}>
      {t(entry.labelKey)}
    </DropdownMenuItem>
  )
}

/** The view's "…" menu, grouped like VS Code's: top commands, then one submenu per group. */
export function ScmMenu({ top, groups }: { top: MenuEntry[]; groups: MenuGroup[] }) {
  const t = useT()
  const label = t('git-changes:scm.menu.more')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={SIZE_ICON_SM} variant={VARIANT_GHOST} data-testid={T.scmMenu} aria-label={label} title={label}>
          <Ellipsis size={DIFF_ICON_PX} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={ALIGN_END} className="min-w-48">
        {top.map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
        <DropdownMenuSeparator />
        {groups.map((group) => (
          <DropdownMenuSub key={group.id}>
            <DropdownMenuSubTrigger data-testid={T.scmMenuItem(group.id)}>{t(group.labelKey)}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-48">
              {group.items.map((entry) => (
                <Entry key={entry.id} entry={entry} />
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
