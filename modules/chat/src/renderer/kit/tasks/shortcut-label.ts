import { MAC_USER_AGENT_RE } from '../../../constants'

const SEPARATOR = '+'
const MAC_GLYPHS: Record<string, string> = { CmdOrCtrl: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' }
const OTHER_NAMES: Record<string, string> = { CmdOrCtrl: 'Ctrl' }

/** An Electron accelerator as the platform writes it: `⌘⇧A` on macOS, `Ctrl+Shift+A` elsewhere. */
export function shortcutLabel(accelerator: string, userAgent = globalThis.navigator?.userAgent ?? ''): string {
  const keys = accelerator.split(SEPARATOR)
  if (MAC_USER_AGENT_RE.test(userAgent)) return keys.map((k) => MAC_GLYPHS[k] ?? k).join('')
  return keys.map((k) => OTHER_NAMES[k] ?? k).join(SEPARATOR)
}
