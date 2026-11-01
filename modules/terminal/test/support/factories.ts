import { tmpdir } from 'node:os'
import type { SpawnSpec } from '../../packages/pty-daemon/src/protocol'
import type { PtyInfo, PtyService, PtySpawnOptions, TerminalPane, TerminalTab } from '../../src/contract'

const DEFAULT_SCROLLBACK = 1000

/** A valid spawn spec running `/bin/sh -c <script>` (or the given overrides) in the temp dir. */
export function spec(overrides: Partial<SpawnSpec> = {}): SpawnSpec {
  return {
    cwd: tmpdir(),
    command: '/bin/sh',
    args: ['-c', 'exit 0'],
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: tmpdir() },
    scrollback: DEFAULT_SCROLLBACK,
    tags: {},
    cols: 80,
    rows: 24,
    ...overrides,
  }
}

/** Shorthand: a spec running a shell script. */
export const shSpec = (script: string, overrides: Partial<SpawnSpec> = {}): SpawnSpec =>
  spec({ args: ['-c', script], ...overrides })

export interface FakePty {
  pid: number
  writes: string[]
  kills: (string | undefined)[]
  resizes: [number, number][]
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
  onData(cb: (d: string) => void): { dispose(): void }
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): { dispose(): void }
  /** Test controls: emit output or an exit as the process would. */
  emitData(data: string): void
  emitExit(e: { exitCode: number; signal?: number }): void
}

const FAKE_PID = 424242

/** An in-memory stand-in for node-pty's `IPty`. */
export function fakePty(): FakePty {
  const data = new Set<(d: string) => void>()
  const exit = new Set<(e: { exitCode: number; signal?: number }) => void>()
  const sub = <T>(set: Set<T>, cb: T) => {
    set.add(cb)
    return { dispose: () => set.delete(cb) }
  }
  const fake: FakePty = {
    pid: FAKE_PID,
    writes: [],
    kills: [],
    resizes: [],
    write: (d) => fake.writes.push(d),
    resize: (c, r) => fake.resizes.push([c, r]),
    kill: (s) => fake.kills.push(s),
    onData: (cb) => sub(data, cb),
    onExit: (cb) => sub(exit, cb),
    emitData: (d) => {
      for (const cb of data) cb(d)
    },
    emitExit: (e) => {
      for (const cb of exit) cb(e)
    },
  }
  return fake
}

let nextId = 1
const uid = (prefix: string): string => `${prefix}-${nextId++}`

/** A layout pane bound to a pty. */
export function pane(overrides: Partial<TerminalPane> = {}): TerminalPane {
  return { id: uid('pane'), ptyId: uid('pty'), exit: null, error: null, ...overrides }
}

/** A single-pane tab. */
export function tab(overrides: Partial<TerminalTab> = {}): TerminalTab {
  const panes = overrides.panes ?? [pane()]
  return {
    id: uid('tab'),
    ordinal: 1,
    customTitle: null,
    split: 'none',
    panes,
    activePaneId: panes[0]?.id ?? '',
    ...overrides,
  }
}

export interface FakePtyService extends PtyService {
  spawned: PtySpawnOptions[]
  killed: { ptyId: string; signal?: string }[]
  /** Makes the next spawn reject with this message. */
  failNextSpawn(message: string): void
}

/** An in-memory `PtyService`: spawns get ids `pty-<n>`, `kill` removes them from `list()`. */
export function fakePtyService(): FakePtyService {
  const infos = new Map<string, PtyInfo>()
  let failure: string | undefined
  let n = 0
  const svc: FakePtyService = {
    spawned: [],
    killed: [],
    failNextSpawn: (message) => {
      failure = message
    },
    async spawn(opts) {
      if (failure) {
        const message = failure
        failure = undefined
        throw new Error(message)
      }
      svc.spawned.push(opts)
      const ptyId = `pty-${++n}`
      infos.set(ptyId, {
        ptyId,
        pid: n,
        cwd: opts.cwd,
        command: opts.command ?? '/bin/sh',
        args: opts.args ?? [],
        tags: opts.tags ?? {},
        cols: opts.cols,
        rows: opts.rows,
        status: 'running',
        exitCode: null,
        signal: null,
        createdAt: n,
        bracketedPaste: false,
      })
      return ptyId
    },
    async kill(ptyId, signal) {
      svc.killed.push({ ptyId, signal })
      infos.delete(ptyId)
    },
    list: (filter) =>
      [...infos.values()].filter((i) => Object.entries(filter?.tags ?? {}).every(([k, v]) => i.tags[k] === v)),
    get: (ptyId) => infos.get(ptyId),
    write: () => undefined,
    paste: () => undefined,
    resize: () => undefined,
    isBracketedPasteEnabled: () => false,
    onData: () => () => undefined,
    onExit: () => () => undefined,
    getShellEnv: async () => ({}),
    snapshot: async () => ({ data: '', seq: 0, cols: 80, rows: 24 }),
  }
  return svc
}
