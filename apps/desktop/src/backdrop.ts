import { isTranslucentPalette, type PaletteId } from '@pragma/ui/tokens'
import { DARWIN } from './constants'

/**
 * What shows behind a translucent palette (glass.css reads it from `data-backdrop`): `native` is macOS window
 * vibrancy behind a transparent window, `css` a gradient the renderer paints itself.
 */
export const BACKDROPS = ['native', 'css'] as const
export type Backdrop = (typeof BACKDROPS)[number]
const [NATIVE, CSS] = BACKDROPS

/** The backdrop this OS can give the window; shared by main (vibrancy) and the renderer (`data-backdrop`). */
export const backdropFor = (platform: string): Backdrop => (platform === DARWIN ? NATIVE : CSS)

/** The window turns see-through with vibrancy only for a translucent palette, and never under reduced transparency. */
export const wantsVibrancy = (platform: string, palette: PaletteId, reducedTransparency: boolean): boolean =>
  isTranslucentPalette(palette) && !reducedTransparency && backdropFor(platform) === NATIVE
