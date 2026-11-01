import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineCapability } from '@pragma/sdk'
import { DISPOSED_MARKER, DISPOSED_TEXT, PONG, PROVIDER_ID } from '../constants'

/** Factory form: created lazily with `capCtx`; `dispose` leaves a marker so tests can see it ran. */
export default defineCapability(PROVIDER_ID, 'ping', (capCtx) => ({
  ping: () => PONG,
  dispose: () => {
    mkdirSync(capCtx.paths.data, { recursive: true })
    writeFileSync(join(capCtx.paths.data, DISPOSED_MARKER), DISPOSED_TEXT)
  },
}))
