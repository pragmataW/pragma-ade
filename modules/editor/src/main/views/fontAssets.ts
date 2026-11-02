import interLatinExt from '@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?inline'
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?inline'
import monoLatinExt from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-ext-wght-normal.woff2?inline'
import monoLatin from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?inline'
import { FONT_MONO, FONT_SANS } from '@pragma/ui/tokens'
import { FONT_UNICODE_RANGE as RANGE, FONT_WEIGHT_RANGE as WEIGHT } from '../../constants'
import { dataUrlBase64, type FontFile, primaryFamily } from './workbenchFonts'

const sans = primaryFamily(FONT_SANS)
const mono = primaryFamily(FONT_MONO)

/** The same fontsource files the renderer bundles (`@pragma/ui` styles), inlined into the main bundle. */
export const WORKBENCH_FONT_FILES: readonly FontFile[] = [
  { family: sans, weight: WEIGHT.sans, unicodeRange: RANGE.latin, base64: dataUrlBase64(interLatin) },
  { family: sans, weight: WEIGHT.sans, unicodeRange: RANGE.latinExt, base64: dataUrlBase64(interLatinExt) },
  { family: mono, weight: WEIGHT.mono, unicodeRange: RANGE.latin, base64: dataUrlBase64(monoLatin) },
  { family: mono, weight: WEIGHT.mono, unicodeRange: RANGE.latinExt, base64: dataUrlBase64(monoLatinExt) },
]
