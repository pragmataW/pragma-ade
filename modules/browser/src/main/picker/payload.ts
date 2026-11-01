import { z } from '@pragma/sdk'
import {
  PROBE_NAME_MAX,
  REDACTED,
  SELECTOR_MAX,
  SENSITIVE_PARAM_RE,
  STYLE_VALUE_MAX,
  TITLE_MAX,
  TRUNCATION_MARKER,
  URL_MAX,
  VIEWPORT_MAX_PX,
} from '../../constants'
import type { BrowserSettings } from '../../contract'
import type { RawPickedElement } from './page/types'

/** Cuts `value` to `max` characters plus the truncation marker. */
export const clampText = (value: string, max: number): string =>
  value.length <= max ? value : value.slice(0, max) + TRUNCATION_MARKER(value.length - max)

const text = (max: number) => z.string().transform((v) => clampText(v, max))
const finite = z.number().refine(Number.isFinite)
const extent = finite.pipe(z.number().min(0).max(VIEWPORT_MAX_PX))

const rawPickSchema = (s: BrowserSettings) =>
  z.object({
    url: text(URL_MAX),
    title: text(TITLE_MAX),
    selector: text(SELECTOR_MAX),
    domPath: text(SELECTOR_MAX),
    tagName: text(PROBE_NAME_MAX),
    outerHtml: text(s.outerHtmlMaxChars),
    text: text(s.textMaxChars),
    rect: z.object({ x: finite, y: finite, width: finite, height: finite }),
    viewport: z.object({ width: extent, height: extent }),
    styles: z
      .record(z.string(), z.string())
      .transform((styles) =>
        Object.fromEntries(
          s.styleProps
            .filter((p) => Object.hasOwn(styles, p))
            .map((p) => [p, clampText(styles[p] ?? '', STYLE_VALUE_MAX)]),
        ),
      ),
  })

/** The page's untrusted payload, validated and clamped; null when it does not have the expected shape. */
export function parseRawPick(raw: unknown, s: BrowserSettings): RawPickedElement | null {
  const parsed = rawPickSchema(s).safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** Drops userinfo and fragment and redacts the values of sensitive query parameters. */
export function sanitizeUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return clampText(url, URL_MAX)
  }
  parsed.username = ''
  parsed.password = ''
  parsed.hash = ''
  for (const key of [...parsed.searchParams.keys()])
    if (SENSITIVE_PARAM_RE.test(key)) parsed.searchParams.set(key, REDACTED)
  return clampText(parsed.href, URL_MAX)
}
