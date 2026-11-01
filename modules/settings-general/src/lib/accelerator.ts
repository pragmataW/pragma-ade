import { ACCELERATOR_SEPARATOR, DARWIN, MAC_ACCELERATOR_TOKENS, OTHER_ACCELERATOR_TOKENS } from '../constants'

/** Electron accelerator → display keys (`CmdOrCtrl+K` → `⌘ K` on macOS, `Ctrl K` elsewhere). */
export function acceleratorKeys(accelerator: string, platform: string): string[] {
  const table = platform === DARWIN ? MAC_ACCELERATOR_TOKENS : OTHER_ACCELERATOR_TOKENS
  return accelerator.split(ACCELERATOR_SEPARATOR).map((token) => table[token.toLowerCase()] ?? token.toUpperCase())
}
