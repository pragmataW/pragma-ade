import type { RendererContext } from '@pragma/sdk/renderer'
import type { BoardSettings } from '../../contract'

export type BoardRendererContext = RendererContext<BoardSettings>

export class RendererNotActivatedError extends Error {}

let current: BoardRendererContext | undefined

/** Holds the module's renderer context (set in `activate`). */
export function setBoardCtx(ctx: BoardRendererContext | undefined): void {
  current = ctx
}

export function boardCtx(): BoardRendererContext {
  if (!current) throw new RendererNotActivatedError('board renderer is not activated')
  return current
}
