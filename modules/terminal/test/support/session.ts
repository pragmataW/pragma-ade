import { Unicode11Addon } from '@xterm/addon-unicode11'
import xtermHeadless from '@xterm/headless'
import type { DaemonEvent, PtySnapshot } from '../../packages/pty-daemon/src/protocol'
import { waitFor } from './process'

/** Records a session's events; `exit()` waits for the exit event. */
export function eventLog() {
  const events: DaemonEvent[] = []
  const of = <K extends DaemonEvent['kind']>(kind: K) =>
    events.filter((e): e is Extract<DaemonEvent, { kind: K }> => e.kind === kind)
  return {
    events,
    emit: (e: DaemonEvent) => events.push(e),
    of,
    text: () =>
      of('data')
        .map((e) => e.data)
        .join(''),
    exit: (timeoutMs?: number) => waitFor(() => of('exit')[0], timeoutMs),
  }
}

/** Writes a snapshot into a fresh headless terminal (Unicode 11, like the session's mirror). */
export async function restore(snapshot: PtySnapshot) {
  const term = new xtermHeadless.Terminal({ cols: snapshot.cols, rows: snapshot.rows, allowProposedApi: true })
  term.loadAddon(new Unicode11Addon())
  term.unicode.activeVersion = '11'
  await new Promise<void>((resolve) => term.write(snapshot.data, resolve))
  return term
}
