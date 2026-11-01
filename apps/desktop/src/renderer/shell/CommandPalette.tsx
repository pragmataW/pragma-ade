import { ShellTestIds as T } from '@pragma/sdk'
import { useRendererHost, useT } from '@pragma/sdk/renderer'
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from '@pragma/ui/components/command'
import { useShell, useShellStore } from '../lib/shell-context'

/** ⌘K palette over every command with a title (main + renderer), except those with `palette: false`. */
export function CommandPalette() {
  const t = useT()
  const host = useRendererHost()
  const store = useShellStore()
  const open = useShell((s) => s.paletteOpen)
  const close = () => store.setState({ paletteOpen: false })
  const items = open ? host.commands.list().filter((c) => c.titleKey && c.palette !== false) : []
  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => store.setState({ paletteOpen: next })}
      title={t('core:palette.title')}
      description={t('core:palette.description')}
    >
      <div data-testid={T.commandPalette}>
        <CommandInput placeholder={t('core:palette.placeholder')} />
        <CommandList>
          <CommandEmpty>{t('core:palette.empty')}</CommandEmpty>
          {items.map((c) => (
            <CommandItem
              key={c.id}
              value={`${c.id} ${t(c.titleKey as string)}`}
              data-testid={T.commandItem(c.id)}
              onSelect={() => {
                close()
                void host.commands.execute(c.id).catch((e) => host.log.error(`palette ${c.id}`, e))
              }}
            >
              {t(c.titleKey as string)}
            </CommandItem>
          ))}
        </CommandList>
      </div>
    </CommandDialog>
  )
}
