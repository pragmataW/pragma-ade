import { ShellTestIds as T } from '@pragma/sdk'
import { ErrorBoundary, useRendererHost } from '@pragma/sdk/renderer'
import { useStore } from 'zustand'
import { EMPTY_ICONS } from '../constants'
import { EmptyState } from './EmptyState'

/** The active center view (`ctx.views`), or an empty state. */
export function CenterArea() {
  const host = useRendererHost()
  const view = useStore(host.registries.store, (s) => s.views.find((v) => v.id === s.activeView))
  if (!view)
    return (
      <EmptyState
        textKey="core:center.empty"
        descriptionKey="core:center.emptyHint"
        paletteHintKey="core:center.paletteHint"
        icon={EMPTY_ICONS.center}
        testId={T.centerEmpty}
      />
    )
  return (
    <ErrorBoundary key={view.id} name={`view ${view.id}`}>
      <view.component />
    </ErrorBoundary>
  )
}
