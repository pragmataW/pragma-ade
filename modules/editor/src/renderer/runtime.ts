import type { RendererContext } from '@pragma/sdk/renderer'
import type { EditorSettings } from '../contract'

/** The renderer pieces components use (set by `activate`, by tests through `setEditorRuntime`). */
export interface EditorRendererRuntime {
  ctx: Pick<RendererContext<EditorSettings>, 'ipc' | 'services' | 'settings' | 'panels'>
}

let current: EditorRendererRuntime | undefined

export const setEditorRendererRuntime = (rt: EditorRendererRuntime | undefined): void => {
  current = rt
}

export function editorRuntime(): EditorRendererRuntime {
  if (!current) throw new Error('editor: renderer module is not active')
  return current
}
