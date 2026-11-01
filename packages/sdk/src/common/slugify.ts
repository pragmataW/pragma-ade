import { SLUG_MAX_LENGTH } from '../constants'

const DOTLESS_I = /ı/g
const COMBINING_MARKS = /\p{M}/gu
const NON_ALNUM_RUN = /[^a-z0-9]+/g
const EDGE_DASHES = /^-+|-+$/g
const TRAILING_DASHES = /-+$/

/** Lowercase ASCII slug: `'Çalışma ağacı'` → `'calisma-agaci'` (§10.4). */
export function slugify(text: string, opts: { maxLength?: number } = {}): string {
  const maxLength = opts.maxLength ?? SLUG_MAX_LENGTH
  const ascii = text.replace(DOTLESS_I, 'i').normalize('NFKD').toLowerCase().replace(COMBINING_MARKS, '')
  const slug = ascii.replace(NON_ALNUM_RUN, '-').replace(EDGE_DASHES, '')
  return slug.slice(0, maxLength).replace(TRAILING_DASHES, '')
}
