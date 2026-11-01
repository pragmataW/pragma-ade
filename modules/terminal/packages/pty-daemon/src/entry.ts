import { PtyDaemon } from './daemon'
import { ensureSpawnHelperExecutable } from './spawn-helper'
import { processTransport } from './transport'

/** Bundled to `dist/pty-daemon.cjs` and forked by main with `ELECTRON_RUN_AS_NODE=1`. */
process.on('uncaughtException', (error) => console.error('pty-daemon: uncaught', error))
process.on('unhandledRejection', (error) => console.error('pty-daemon: unhandled rejection', error))
ensureSpawnHelperExecutable()
new PtyDaemon(processTransport()).start()
