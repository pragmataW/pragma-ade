import type { DaemonMessage } from './protocol'

/** The daemon's link to main: an IPC channel in production, an in-memory pair in tests. */
export interface Transport {
  send(msg: DaemonMessage): void
  onMessage(cb: (raw: unknown) => void): void
  onClose(cb: () => void): void
}

/** `child_process.fork` IPC channel; a closed channel (parent gone) is reported through `onClose`. */
export function processTransport(proc: NodeJS.Process = process): Transport {
  return {
    send(msg) {
      if (proc.connected && proc.send) proc.send(msg)
    },
    onMessage(cb) {
      proc.on('message', cb)
    },
    onClose(cb) {
      proc.on('disconnect', cb)
    },
  }
}
