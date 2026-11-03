/** Where the selected-tab line sits along its tab list: the selected tab's offset and width. */
export interface IndicatorPlacement {
  x: number
  width: number
}

/** The selected tab among the list's own children (ARIA tabs and Radix triggers both set `aria-selected`). */
const SELECTED_TAB = ':scope > [aria-selected="true"]'

export function findSelectedTab(list: Element): HTMLElement | null {
  return list.querySelector<HTMLElement>(SELECTED_TAB)
}

/** The line spans the tab; `null` without one, or while it is not laid out (a hidden panel has zero width). */
export function indicatorPlacement(
  tab: Pick<HTMLElement, 'offsetLeft' | 'offsetWidth'> | null,
): IndicatorPlacement | null {
  if (!tab || tab.offsetWidth <= 0) return null
  return { x: tab.offsetLeft, width: tab.offsetWidth }
}

export function samePlacement(a: IndicatorPlacement | null, b: IndicatorPlacement | null): boolean {
  return a?.x === b?.x && a?.width === b?.width
}

/**
 * Calls `onChange` with the selected tab's placement now and whenever it may move: selection changes, tabs added,
 * removed or reordered, text that resizes a tab, and the list or the tab resizing. Returns the cleanup.
 */
export function watchSelectedTab(list: HTMLElement, onChange: (placement: IndicatorPlacement | null) => void) {
  let observed: HTMLElement | null = null
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure()) : null
  function measure() {
    const tab = findSelectedTab(list)
    if (tab !== observed) {
      if (observed) resize?.unobserve(observed)
      if (tab) resize?.observe(tab)
      observed = tab
    }
    onChange(indicatorPlacement(tab))
  }
  const mutations = new MutationObserver(measure)
  mutations.observe(list, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-selected'],
  })
  resize?.observe(list)
  measure()
  return () => {
    mutations.disconnect()
    resize?.disconnect()
  }
}
