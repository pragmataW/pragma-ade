import { dirname, join, relative } from 'node:path'
import {
  ARCH,
  ARCH_X64_FLAG,
  ASAR_UNPACKED_SUFFIX,
  DARWIN,
  DOCKER_APP_MOUNT,
  DOCKER_PROBE_MOUNT,
  ELECTRON_RUN_AS_NODE_ENV,
  EMULATION_CRASH,
  ENABLED,
  LINUX_PROBE_IMAGE,
  LINUX_PROBE_TIMEOUT_MS,
  LINUX_RUNTIME_LIBS,
  PARENT_SEGMENT,
  POSIX_SEP,
  PROBE_CHECK,
  PROBE_SCRIPT,
  PROBE_TIMEOUT_MS,
  RUN_SUBCOMMAND,
  SKIP_REASON,
} from '../constants.ts'
import { type AppLayout, nativeRoots } from './archive.ts'
import { dockerRun, ensureDocker } from './docker.ts'
import { run } from './exec.ts'
import { findNativePackages } from './natives.ts'
import { type ProbeResult, ProbeResultSchema } from './schema.ts'
import type { Target } from './targets.ts'

export interface ProbeEntry {
  name: string
  dir: string
}

const PROBE_PATH = join(import.meta.dirname, PARENT_SEGMENT, PROBE_SCRIPT)
const JSON_START = '{'

/** Unpacked packages are required through their `app.asar` path, as the app does (their deps stay in the asar). */
const asarPath = (dir: string, asar: string): string => {
  const unpacked = `${asar}${ASAR_UNPACKED_SUFFIX}`
  return dir.startsWith(unpacked) ? `${asar}${dir.slice(unpacked.length)}` : dir
}

/** Native packages of a packaged app (asar.unpacked and staged resources), one entry per package dir. */
export async function probeList(layout: AppLayout, target: Target): Promise<ProbeEntry[]> {
  const out: ProbeEntry[] = []
  for (const root of nativeRoots(layout))
    for (const p of await findNativePackages(root, target))
      out.push({ name: p.name, dir: asarPath(p.dir, layout.asar) })
  return out
}

/** The probe's JSON line; anything else becomes a failed result carrying the output tail. */
export function parseProbeOutput(stdout: string, stderr: string): ProbeResult {
  const line = stdout
    .trim()
    .split('\n')
    .reverse()
    .find((l) => l.trim().startsWith(JSON_START))
  if (line) {
    const parsed = ProbeResultSchema.safeParse(JSON.parse(line))
    if (parsed.success) return parsed.data
  }
  return {
    ok: false,
    results: [{ name: PROBE_CHECK, ok: false, op: RUN_SUBCOMMAND, error: `${stdout}\n${stderr}`.trim() }],
  }
}

/** Runs the probe with the packaged executable as Node (darwin-x64 under Rosetta on an arm64 host). */
export async function probeHost(layout: AppLayout, target: Target): Promise<ProbeResult> {
  if (target.platform !== process.platform) return { ok: false, results: [], skipped: SKIP_REASON.unsupported }
  const list = JSON.stringify(await probeList(layout, target))
  const rosetta = target.platform === DARWIN && target.arch !== process.arch
  const [cmd, args] = rosetta
    ? [ARCH, [ARCH_X64_FLAG, layout.executable, PROBE_PATH, list]]
    : [layout.executable, [PROBE_PATH, list]]
  const r = await run(cmd, args, {
    allowFail: true,
    timeoutMs: PROBE_TIMEOUT_MS,
    env: { ...process.env, [ELECTRON_RUN_AS_NODE_ENV]: ENABLED },
  })
  return parseProbeOutput(r.stdout, r.stderr)
}

const quote = (s: string): string => `'${s.replaceAll("'", `'"'"'`)}'`
const inContainer = (root: string, path: string): string =>
  `${DOCKER_APP_MOUNT}/${relative(root, path).split('\\').join(POSIX_SEP)}`

/** Runs the probe inside `debian:bookworm-slim` (linux/amd64) against an extracted Linux app rooted at `root`. */
export async function probeLinuxInDocker(root: string, layout: AppLayout, target: Target): Promise<ProbeResult> {
  const docker = await ensureDocker({ autoStart: true })
  if (!docker.ok) return { ok: false, results: [], skipped: SKIP_REASON.docker }
  const list = (await probeList(layout, target)).map((e) => ({ name: e.name, dir: inContainer(root, e.dir) }))
  const probe = `${DOCKER_PROBE_MOUNT}/${PROBE_SCRIPT.split(POSIX_SEP).at(-1)}`
  const script = [
    'set -e',
    `apt-get update -qq >/dev/null && apt-get install -y -qq --no-install-recommends ${LINUX_RUNTIME_LIBS.join(' ')} >/dev/null 2>&1`,
    `${ELECTRON_RUN_AS_NODE_ENV}=${ENABLED} ${quote(inContainer(root, layout.executable))} ${probe} ${quote(JSON.stringify(list))}`,
  ].join('\n')
  const r = await dockerRun({
    image: LINUX_PROBE_IMAGE,
    mounts: [
      { host: root, container: DOCKER_APP_MOUNT, readOnly: true },
      { host: dirname(PROBE_PATH), container: DOCKER_PROBE_MOUNT, readOnly: true },
    ],
    script,
    timeoutMs: LINUX_PROBE_TIMEOUT_MS,
    allowFail: true,
  })
  const result = parseProbeOutput(r.stdout, r.stderr)
  if (!result.ok && result.results.length <= 1 && EMULATION_CRASH.test(r.stderr))
    return { ok: false, results: result.results, skipped: SKIP_REASON.emulation }
  return result
}
