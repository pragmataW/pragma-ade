import type { RendererContext } from '@pragma/sdk/renderer'
import type { CommentsSettings } from '../contract'

/** The renderer context pieces the store, send flow and components use (also from other modules' trees). */
export type CommentsRuntime = Pick<
  RendererContext<CommentsSettings>,
  'ipc' | 'commands' | 'services' | 'settings' | 'dialogs'
>

let current: CommentsRuntime | undefined

export const setRuntime = (rt: CommentsRuntime | undefined): void => {
  current = rt
}

export function runtime(): CommentsRuntime {
  if (!current) throw new Error('comments: renderer module is not active')
  return current
}
