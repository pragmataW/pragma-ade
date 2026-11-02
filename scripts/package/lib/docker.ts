import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import {
  DOCKER,
  DOCKER_ANON_CONFIG,
  DOCKER_APP_PATH,
  DOCKER_CONFIG_DIR,
  DOCKER_CONFIG_ENV,
  DOCKER_CONFIG_FILE,
  DOCKER_HOST_ENV,
  DOCKER_PLATFORM,
  DOCKER_POLL_MS,
  DOCKER_START_TIMEOUT_MS,
  DOCKER_WORK_DIR,
  ELECTRON_HEADERS_URL,
  LINUX_BUILD_IMAGE,
  NATIVE_COMPILE_TIMEOUT_MS,
  NODE_GYP_VERSION,
  OPEN_BIN,
  RUN_SUBCOMMAND,
} from '../constants.ts'
import { type RunResult, run } from './exec.ts'
import { cacheRoot } from './fsx.ts'

export type DockerStatus = { ok: true; serverVersion: string } | { ok: false; reason: string }

const SERVER_VERSION_ARGS = ['info', '--format', '{{.ServerVersion}}']
const OPEN_DOCKER_ARGS = ['-g', '-a', 'Docker']

const CONTEXT_HOST_ARGS = ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']
let isolatedEnv: NodeJS.ProcessEnv | undefined

/**
 * Docker env with an anonymous client config (public images only) and the current context's host, so the
 * user's credential helper is never invoked; the user's ~/.docker is only read (context endpoint).
 */
async function dockerEnv(): Promise<NodeJS.ProcessEnv> {
  if (isolatedEnv) return isolatedEnv
  const dir = join(cacheRoot(), DOCKER_CONFIG_DIR)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, DOCKER_CONFIG_FILE), DOCKER_ANON_CONFIG)
  const host = process.env[DOCKER_HOST_ENV] || (await run(DOCKER, CONTEXT_HOST_ARGS, { allowFail: true })).stdout.trim()
  isolatedEnv = { ...process.env, [DOCKER_CONFIG_ENV]: dir, ...(host ? { [DOCKER_HOST_ENV]: host } : {}) }
  return isolatedEnv
}

async function serverVersion(): Promise<string | null> {
  const r = await run(DOCKER, SERVER_VERSION_ARGS, { allowFail: true, env: await dockerEnv() })
  const v = r.stdout.trim()
  return r.code === 0 && v ? v : null
}

/** Docker daemon up, or started (Docker Desktop, `open -g -a Docker`) and polled when `autoStart`. */
export async function ensureDocker(o: { autoStart: boolean }): Promise<DockerStatus> {
  const now = await serverVersion()
  if (now) return { ok: true, serverVersion: now }
  if (!o.autoStart) return { ok: false, reason: 'docker daemon is not running (auto start disabled)' }
  if (!existsSync(DOCKER_APP_PATH))
    return { ok: false, reason: `docker daemon is not running and ${DOCKER_APP_PATH} is missing` }
  await run(OPEN_BIN, OPEN_DOCKER_ARGS, { allowFail: true })
  const deadline = Date.now() + DOCKER_START_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(DOCKER_POLL_MS)
    const v = await serverVersion()
    if (v) return { ok: true, serverVersion: v }
  }
  return { ok: false, reason: `docker daemon did not start within ${DOCKER_START_TIMEOUT_MS} ms` }
}

export interface DockerMount {
  host: string
  container: string
  readOnly?: boolean
}

/** `docker run --rm --platform linux/amd64 -v … -w … <image> bash -lc <script>` with array args. */
export async function dockerRun(o: {
  image: string
  mounts: readonly DockerMount[]
  workdir?: string
  script: string
  timeoutMs?: number
  allowFail?: boolean
}): Promise<RunResult> {
  const volumes = o.mounts.flatMap((m) => ['-v', `${m.host}:${m.container}${m.readOnly ? ':ro' : ''}`])
  const workdir = o.workdir ? ['-w', o.workdir] : []
  return run(
    DOCKER,
    [RUN_SUBCOMMAND, '--rm', '--platform', DOCKER_PLATFORM, ...volumes, ...workdir, o.image, 'bash', '-lc', o.script],
    {
      timeoutMs: o.timeoutMs ?? NATIVE_COMPILE_TIMEOUT_MS,
      allowFail: o.allowFail,
    },
  )
}

/** Compiles `<root>/<pkgRelDir>` for linux-x64 glibc in `node:22-bullseye`; returns the .node files and max GLIBC. */
export async function dockerCompileNative(
  root: string,
  pkgRelDir: string,
  electronVersion: string,
): Promise<{ files: string[]; glibcMax: string }> {
  const gyp = `npx -y node-gyp@${NODE_GYP_VERSION} rebuild --release --target=${electronVersion} --dist-url=${ELECTRON_HEADERS_URL}`
  const glibc = "objdump -T build/Release/*.node | grep -o 'GLIBC_[0-9.]*' | sort -uV | tail -1"
  const list = 'ls build/Release/*.node'
  const r = await dockerRun({
    image: LINUX_BUILD_IMAGE,
    mounts: [{ host: root, container: DOCKER_WORK_DIR }],
    workdir: `${DOCKER_WORK_DIR}/${pkgRelDir}`,
    script: `set -e; ${gyp} >&2; ${list}; ${glibc}`,
  })
  const lines = r.stdout
    .trim()
    .split('\n')
    .map((l) => l.trim())
  const glibcMax = lines.pop() ?? ''
  const prefix = `${DOCKER_WORK_DIR}/${pkgRelDir}/`
  const files = lines.map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l))
  return { files, glibcMax }
}
