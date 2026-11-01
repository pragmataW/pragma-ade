import { CLIPBOARD_COMMAND } from '../constants/ui'

const HIDDEN_STYLE = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'

function execCommandCopy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.cssText = HIDDEN_STYLE
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand(CLIPBOARD_COMMAND)
  } catch {
    return false
  } finally {
    area.remove()
  }
}

/** Copies text; falls back to a hidden textarea when the async clipboard API rejects. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return execCommandCopy(text)
  }
}
