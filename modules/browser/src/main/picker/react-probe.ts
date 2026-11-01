import { z } from '@pragma/sdk'
import {
  PICK_ATTR,
  PROBE_NAME_MAX,
  PROBE_SOURCE_MAX,
  REACT_MAX_FIBER_DEPTH,
  REACT_SKIP_NAME_RES,
} from '../../constants'
import type { BrowserPick } from '../../contract'
import { fiberName, fiberSource, reactProbe } from './page/react-probe'

/** Main-world expression: the innermost React component of the picked element, or null. */
export function reactProbeScript(nonce: string): string {
  const opts = { nonce, attr: PICK_ATTR, maxDepth: REACT_MAX_FIBER_DEPTH, skipPatterns: REACT_SKIP_NAME_RES }
  const helpers = `{ name: (${fiberName.toString()}), source: (${fiberSource.toString()}) }`
  return `(${reactProbe.toString()})(${JSON.stringify(opts)}, ${helpers})`
}

const clip = (max: number) => z.string().transform((v) => v.slice(0, max))
const ProbeSchema = z.object({
  name: clip(PROBE_NAME_MAX).pipe(z.string().min(1)),
  source: clip(PROBE_SOURCE_MAX).optional(),
})

/** The probe's untrusted result, validated and clamped. */
export function parseReactProbe(raw: unknown): BrowserPick['component'] {
  const parsed = ProbeSchema.safeParse(raw)
  if (!parsed.success) return null
  const { name, source } = parsed.data
  return source ? { name, source } : { name }
}
