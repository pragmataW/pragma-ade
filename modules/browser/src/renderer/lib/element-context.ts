import type { BrowserElementContext } from '@pragma/module-comments/contract'
import type { BrowserPick } from '../../contract'

export interface PickToggles {
  includeConsoleErrors: boolean
  includeScreenshotAndStyles: boolean
}

/** 05's `BrowserElementContext` for a pick; optional keys are omitted (never null). */
export function toElementContext(pick: BrowserPick, o: PickToggles): BrowserElementContext {
  const context: BrowserElementContext = {
    url: pick.url,
    selector: pick.selector,
    outerHtml: pick.outerHtml,
    text: pick.text,
    boundingBox: pick.rect,
  }
  if (pick.component) context.component = pick.component
  if (o.includeScreenshotAndStyles) {
    context.styles = pick.styles
    if (pick.screenshotPath) context.screenshotPath = pick.screenshotPath
  }
  if (o.includeConsoleErrors && pick.consoleErrors.length > 0) context.consoleErrors = pick.consoleErrors
  return context
}
