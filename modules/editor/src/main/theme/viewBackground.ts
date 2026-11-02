import type { MainContext } from '@pragma/sdk/main'
import { VIEW_BACKGROUND_TOKEN } from '../../constants'

/** The part of a `WebContentsView` that paints behind the page. */
export interface BackgroundView {
  setBackgroundColor(color: string): void
}

/**
 * Paints the workbench views in the app background: before a page paints (first load, reload after a server
 * restart) the view shows this colour instead of white or the previous mode's colour.
 */
export class ViewBackground {
  readonly #theme: Pick<MainContext['theme'], 'get' | 'onChange'>
  readonly #views: () => Iterable<BackgroundView>

  constructor(o: { theme: Pick<MainContext['theme'], 'get' | 'onChange'>; views: () => Iterable<BackgroundView> }) {
    this.#theme = o.theme
    this.#views = o.views
  }

  apply(view: BackgroundView): void {
    const color = this.#theme.get().tokens[VIEW_BACKGROUND_TOKEN]
    if (color) view.setBackgroundColor(color)
  }

  /** Repaints every live view (hidden ones too) on each app theme change. */
  start(): () => void {
    const sub = this.#theme.onChange(() => {
      for (const v of this.#views()) this.apply(v)
    })
    return () => sub.dispose()
  }
}
