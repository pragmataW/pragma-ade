import { WebglAddon } from '@xterm/addon-webgl'
import type { Terminal } from '@xterm/xterm'
import { RENDERER_MODE, type RendererMode } from '../../contract'

export const ACTIVE_RENDERERS = { webgl: 'webgl', dom: 'dom' } as const
export type ActiveRenderer = (typeof ACTIVE_RENDERERS)[keyof typeof ACTIVE_RENDERERS]

/**
 * WebGL when allowed and available; otherwise (or after a lost GPU context) xterm 6's DOM renderer. There is no
 * canvas fallback: `@xterm/addon-canvas` does not support xterm 6.
 */
export function loadPreferredRenderer(term: Terminal, setting: RendererMode): ActiveRenderer {
  if (setting === RENDERER_MODE.dom) return ACTIVE_RENDERERS.dom
  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => webgl.dispose())
    term.loadAddon(webgl)
    return ACTIVE_RENDERERS.webgl
  } catch {
    return ACTIVE_RENDERERS.dom
  }
}
