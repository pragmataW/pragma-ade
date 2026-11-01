import { spawn } from 'node:child_process'
import type { CreateWorktreeInput, Worktree } from '@pragma/module-projects/contract'
import type { PtyExit, PtySpawnOptions } from '@pragma/module-terminal/contract'
import type { EventBus } from '@pragma/sdk/runtime/main'
import type { LaunchContext, LaunchDecorator, LaunchSpec } from '../../src/contract'
import type { ProjectsAccess, PtyAccess } from '../../src/main/service/deps'
import { fakeAgentScript } from '../../testing'

/** Shared unit-test fakes (§9: no copy-pasted setup). */

/** A `writeTempFile` recorder; returns `path` (default `/tmp/s/<name>`). */
export function fakeWriter(path?: string) {
  const calls: [string, string][] = []
  return {
    calls,
    async writeTempFile(name: string, contents: string): Promise<string> {
      calls.push([name, contents])
      return path ?? `/tmp/s/${name}`
    },
  }
}

/** Runs the fake agent with piped stdio; resolves with its stdout and exit code. */
export function spawnFakeAgent(args: string[], opts: { env?: Record<string, string>; cwd?: string; stdin?: string }) {
  const child = spawn(process.execPath, [fakeAgentScript(), ...args], {
    stdio: 'pipe',
    cwd: opts.cwd,
    env: { PATH: process.env.PATH ?? '', ...opts.env },
  })
  let stdout = ''
  child.stdout.setEncoding('utf8').on('data', (d: string) => {
    stdout += d
  })
  if (opts.stdin !== undefined) child.stdin.end(opts.stdin)
  const exited = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)))
  return { child, exited, stdout: () => stdout }
}

/** A logger that records warnings and errors (and their details). */
export function recordingLog() {
  const lines: { level: string; message: string }[] = []
  const at = (level: string) => (message: string) => void lines.push({ level, message })
  const log = { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error'), child: () => log }
  return Object.assign(log, { lines, warnings: () => lines.filter((l) => l.level === 'warn').map((l) => l.message) })
}

/** A decorator from a function. */
export const decorator = (
  id: string,
  order: number,
  decorate: (spec: LaunchSpec, ctx: LaunchContext) => LaunchSpec | Promise<LaunchSpec>,
): LaunchDecorator => ({ id, order, decorate: async (spec, ctx) => decorate(spec, ctx) })

export interface FakeSpawn {
  ptyId: string
  opts: PtySpawnOptions
}

/** A `PtyService` subset: records spawns and kill signals; the test fires exit/data. */
export function fakePty(shellEnv: Record<string, string> = { PATH: '/usr/bin', HOME: '/home/u' }) {
  const spawns: FakeSpawn[] = []
  const signals: string[] = []
  const exitCbs = new Map<string, ((e: PtyExit) => void)[]>()
  const dataCbs = new Map<string, ((d: string) => void)[]>()
  let failNext: Error | undefined
  let n = 0
  const pty: PtyAccess = {
    async spawn(opts) {
      if (failNext) {
        const e = failNext
        failNext = undefined
        throw e
      }
      const ptyId = `pty-${++n}`
      spawns.push({ ptyId, opts })
      return ptyId
    },
    async kill(_ptyId, signal) {
      signals.push(signal ?? 'SIGTERM')
    },
    onExit(ptyId, cb) {
      exitCbs.set(ptyId, [...(exitCbs.get(ptyId) ?? []), cb])
      return () => undefined
    },
    onData(ptyId, cb) {
      dataCbs.set(ptyId, [...(dataCbs.get(ptyId) ?? []), cb])
      return () => undefined
    },
    getShellEnv: async () => shellEnv,
  }
  return {
    pty,
    spawns,
    signals,
    failNextSpawn: (e: Error) => {
      failNext = e
    },
    exit(ptyId: string, exitCode: number | null = 0, reason: PtyExit['reason'] = 'exited') {
      for (const cb of exitCbs.get(ptyId) ?? []) cb({ ptyId, exitCode, signal: null, reason })
    },
    data(ptyId: string, text: string) {
      for (const cb of dataCbs.get(ptyId) ?? []) cb(text)
    },
  }
}
export type FakePty = ReturnType<typeof fakePty>

const aWorktree = (id: string, path: string, projectId = 'proj1'): Worktree => ({
  id,
  projectId,
  path,
  branch: id,
  baseBranch: 'main',
  isMain: false,
  createdAt: 1,
  archivedAt: null,
})

/** A `ProjectsService` subset over in-memory worktrees; `createWorktree` records its input. */
export function fakeProjects(worktrees: [string, string][] = [['w1', '/repo']]) {
  const all = new Map(worktrees.map(([id, path]) => [id, aWorktree(id, path)]))
  const created: CreateWorktreeInput[] = []
  let failCreate: Error | undefined
  const projects: ProjectsAccess = {
    getWorktree: async (id) => all.get(id) ?? null,
    getProject: async (id) => ({
      id,
      name: id,
      repoPath: '/repo',
      defaultBaseBranch: 'main',
      createdAt: 1,
      sortOrder: 0,
    }),
    async createWorktree(input) {
      if (failCreate) throw failCreate
      created.push(input)
      const w = aWorktree(`w-${input.branch}`, `/wt/${input.branch}`, input.projectId)
      all.set(w.id, w)
      return w
    },
  }
  return {
    projects,
    created,
    failCreate: (e: Error) => {
      failCreate = e
    },
  }
}

/** An event bus that records every emit. */
export function fakeEvents() {
  const emitted: { name: string; payload: unknown }[] = []
  const bus: Pick<EventBus, 'emit'> = { emit: (def, payload) => void emitted.push({ name: def.name, payload }) }
  return { bus, emitted, named: (name: string) => emitted.filter((e) => e.name === name).map((e) => e.payload) }
}
