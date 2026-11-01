import { tmpdir } from 'node:os'
import type { IpcContract } from '@pragma/sdk'
import type { MainIpcApi } from '@pragma/sdk/main'
import type { SpawnSpec } from '../../packages/pty-daemon/src/protocol'
import type {
  PtyAttachResult,
  PtyDataPayload,
  PtyExit,
  PtyInfo,
  PtyService,
  PtySpawnOptions,
  TerminalPane,
  TerminalTab,
} from '../../src/contract'
import { paneLeaf } from '../../src/lib/layout-tree'

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

/** A tab of the given panes (one by default) side by side. */
export function tab(overrides: Partial<TerminalTab> = {}): TerminalTab {
  const panes = overrides.panes ?? [pane()]
  return {
    id: uid('tab'),
    ordinal: 1,
    customTitle: null,
    root:
      panes.length > 1
        ? { kind: 'split', direction: 'vertical', children: panes.map((p) => paneLeaf(p.id)) }
        : paneLeaf(panes[0]?.id ?? ''),
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

export interface FakePtyFeed extends FakePtyService {
  attach(ptyId: string): Promise<PtyAttachResult>
  onAnyData(cb: (e: PtyDataPayload) => void): () => void
  onAnyExit(cb: (e: PtyExit) => void): () => void
  emitData(e: PtyDataPayload): void
  emitExit(e: PtyExit): void
}

/** `fakePtyService()` plus the IPC feed (`attach`, any-data/any-exit) with emit controls. */
export function fakePtyFeed(): FakePtyFeed {
  const svc = fakePtyService()
  const data = new Set<(e: PtyDataPayload) => void>()
  const exits = new Set<(e: PtyExit) => void>()
  const add = <T>(set: Set<T>, cb: T) => {
    set.add(cb)
    return () => set.delete(cb)
  }
  return Object.assign(svc, {
    async attach(ptyId: string): Promise<PtyAttachResult> {
      const info = svc.get(ptyId)
      if (!info) return { found: false }
      return { found: true, info, snapshot: await svc.snapshot(ptyId), exit: null }
    },
    onAnyData: (cb: (e: PtyDataPayload) => void) => add(data, cb),
    onAnyExit: (cb: (e: PtyExit) => void) => add(exits, cb),
    emitData: (e: PtyDataPayload) => {
      for (const cb of data) cb(e)
    },
    emitExit: (e: PtyExit) => {
      for (const cb of exits) cb(e)
    },
  })
}

/** A `MainIpcApi` that keeps handlers and published events in memory. */
export function fakeIpc() {
  const handlers = new Map<string, (input: unknown) => unknown>()
  const published: { channel: string; payload: unknown }[] = []
  const ipc: MainIpcApi = {
    handle(c, h) {
      handlers.set(c.channel, (input) => h(c.input.parse(input), { sender: 0 } as never))
      return { dispose: () => handlers.delete(c.channel) }
    },
    publish(c, payload) {
      published.push({ channel: c.channel, payload })
    },
  }
  const call = async <O>(c: IpcContract<unknown, O> | { channel: string }, input: unknown): Promise<O> => {
    const h = handlers.get(c.channel)
    if (!h) throw new Error(`no handler for ${c.channel}`)
    return (await h(input)) as O
  }
  return { ipc, handlers, published, call }
}
