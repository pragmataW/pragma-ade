import { statfsSync } from 'node:fs'
import {
  ARCH,
  ARCH_X64_FLAG,
  BYTES_PER_GB,
  DARWIN,
  DOCKER,
  DOCTOR_PROBE_TIMEOUT_MS,
  MIN_FREE_DISK_GB,
  NODE_MIN,
  NPM,
  PNPM,
  SW_VERS,
  TRUE_BIN,
  VERSION_FLAG,
  WINE,
} from '../constants.ts'
import { run } from './exec.ts'
import type { DoctorReport } from './schema.ts'

const PRODUCT_VERSION_FLAG = '-productVersion'
const DOCKER_SERVER_VERSION_ARGS = ['info', '--format', '{{.ServerVersion}}']
const VERSION_PART = /\d+/g

/** First stdout line of a command, or null when it is missing or fails. */
async function firstLine(cmd: string, args: readonly string[]): Promise<string | null> {
  const r = await run(cmd, args, { allowFail: true, timeoutMs: DOCTOR_PROBE_TIMEOUT_MS })
  const line = r.stdout.trim().split('\n')[0]?.trim()
  return r.code === 0 && line ? line : null
}

const parts = (v: string): number[] => (v.match(VERSION_PART) ?? []).map(Number)

/** `a >= b` for dotted versions (a leading `v` is ignored). */
export function versionAtLeast(a: string, b: string): boolean {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return true
}

const freeGb = (dir: string): number => {
  const s = statfsSync(dir)
  return (s.bavail * s.bsize) / BYTES_PER_GB
}

/** Host facts the packaging run depends on. */
export async function doctor(o: { repoRoot: string }): Promise<DoctorReport> {
  const isMac = process.platform === DARWIN
  const [pnpm, npm, macos, rosetta, dockerCli, serverVersion, wine] = await Promise.all([
    firstLine(PNPM, [VERSION_FLAG]),
    firstLine(NPM, [VERSION_FLAG]),
    isMac ? firstLine(SW_VERS, [PRODUCT_VERSION_FLAG]) : Promise.resolve(null),
    isMac ? run(ARCH, [ARCH_X64_FLAG, TRUE_BIN], { allowFail: true }).then((r) => r.code === 0) : false,
    firstLine(DOCKER, [VERSION_FLAG]),
    firstLine(DOCKER, DOCKER_SERVER_VERSION_ARGS),
    firstLine(WINE, [VERSION_FLAG]),
  ])
  const nodeOk = versionAtLeast(process.version, NODE_MIN)
  const freeDiskGb = freeGb(o.repoRoot)
  return {
    node: process.version,
    nodeOk,
    pnpm,
    npm,
    hostArch: process.arch,
    macos,
    rosetta,
    docker: { cli: dockerCli, daemon: serverVersion !== null, serverVersion },
    wine,
    freeDiskGb,
    ok: nodeOk && !!pnpm && freeDiskGb >= MIN_FREE_DISK_GB,
  }
}
