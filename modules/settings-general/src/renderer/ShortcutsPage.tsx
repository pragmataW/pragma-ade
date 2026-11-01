import { useRendererHost, useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { Kbd, KbdGroup } from '@pragma/ui/components/kbd'
import { useEffect, useState } from 'react'
import { OUTLINE_VARIANT } from '../constants'
import { TEST_IDS } from '../contract/testids'
import { acceleratorKeys } from '../lib/accelerator'

/** Read-only list of `core.shortcuts.list` (§10.2): title, accelerator and scope. */
export function ShortcutsPage() {
  const t = useT()
  const { shortcuts, appInfo } = useRendererHost()
  const [list, setList] = useState(() => shortcuts.list())
  useEffect(() => {
    setList(shortcuts.list())
    const sub = shortcuts.onChange(() => setList(shortcuts.list()))
    return () => sub.dispose()
  }, [shortcuts])
  if (list.length === 0) return <p className="text-[var(--mu)]">{t('settings-general:shortcuts.empty')}</p>
  return (
    <ul className="max-w-[720px] divide-y divide-[var(--bd)] rounded-[var(--radius-card)] border border-[var(--bd)]">
      {list.map((s) => (
        <li
          key={s.id}
          data-testid={TEST_IDS.shortcutRow(s.id)}
          className="flex h-[var(--row-h)] items-center gap-3 px-3"
        >
          <span className="flex-1 truncate">{s.titleKey ? t(s.titleKey) : s.id}</span>
          <Badge variant={OUTLINE_VARIANT}>{t(`settings-general:shortcuts.scope.${s.scope}`)}</Badge>
          <KbdGroup>
            {acceleratorKeys(s.accelerator, appInfo.platform).map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </KbdGroup>
        </li>
      ))}
    </ul>
  )
}
