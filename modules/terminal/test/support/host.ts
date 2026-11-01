import { memoryLogger } from '@pragma/test-support'
import { DaemonHost, type DaemonHostOptions } from '../../src/main/daemon-host'
import { builtDaemon, daemonEnv } from './daemon-bundle'

const hosts: DaemonHost[] = []

/** A real `DaemonHost` on the test bundle and the system node; stopped by `stopHosts()`. */
export async function testHost(opts: Partial<DaemonHostOptions> = {}) {
  const log = memoryLogger()
  const host = new DaemonHost({ entryPath: await builtDaemon(), env: daemonEnv(), log, ...opts })
  hosts.push(host)
  return { host, log }
}

export async function stopHosts(): Promise<void> {
  await Promise.all(hosts.splice(0).map((h) => h.shutdown()))
}
