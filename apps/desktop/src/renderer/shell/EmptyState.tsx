import { useT } from '@pragma/sdk/renderer'
import { EmptyState as UiEmptyState } from '@pragma/ui'
import { DEFAULT_EMPTY_ICON } from '../constants'

/**
 * Centered placeholder: title and optional description (i18n keys) with a test id; `paletteHintKey` adds the
 * command-palette shortcut as a keyboard hint.
 */
export function EmptyState({
  textKey,
  testId,
  icon = DEFAULT_EMPTY_ICON,
  descriptionKey,
  paletteHintKey,
}: {
  textKey: string
  testId: string
  icon?: string
  descriptionKey?: string
  paletteHintKey?: string
}) {
  const t = useT()
  return (
    <UiEmptyState
      testId={testId}
      icon={icon}
      title={t(textKey)}
      description={descriptionKey ? t(descriptionKey) : undefined}
      hint={paletteHintKey ? { keys: [t('core:titlebar.paletteShortcut')], label: t(paletteHintKey) } : undefined}
    />
  )
}
