// Runs inside a packaged app with ELECTRON_RUN_AS_NODE=1: loads every native package and exercises it once.
// Usage: <executable> natives.cjs '<[{"name":"…","dir":"…"}]>'  → one JSON line { ok, results }.
const os = require('node:os')

const PROBE_PTY_TIMEOUT_MS = 15000
const SQL_EXPECTED = 42
const PTY_MARKER = 'PROBE_OK'
const LIST_ARG_INDEX = 2
const WIN32 = 'win32'

const OPS = {
  'better-sqlite3': (mod) => {
    const db = new mod(':memory:')
    const x = db.prepare('select 41+1 as x').get().x
    db.close()
    if (x !== SQL_EXPECTED) throw new Error(`select returned ${x}`)
    return 'select 41+1'
  },
  'node-pty': (mod) => {
    if (process.platform === WIN32) return 'require'
    return new Promise((resolve, reject) => {
      const p = mod.spawn('/bin/sh', ['-c', `echo ${PTY_MARKER}`], { cols: 80, rows: 24 })
      let out = ''
      const timer = setTimeout(
        () => reject(new Error(`pty timeout, output: ${JSON.stringify(out)}`)),
        PROBE_PTY_TIMEOUT_MS,
      )
      p.onData((d) => {
        out += d
      })
      p.onExit(() => {
        clearTimeout(timer)
        if (out.includes(PTY_MARKER)) resolve('spawn /bin/sh')
        else reject(new Error(`pty output without marker: ${JSON.stringify(out)}`))
      })
    })
  },
  '@parcel/watcher': async (mod) => {
    const sub = await mod.subscribe(os.tmpdir(), () => undefined)
    await sub.unsubscribe()
    return 'subscribe tmpdir'
  },
}

async function probe(entry) {
  const op = OPS[entry.name]
  try {
    const mod = require(entry.dir)
    const done = op ? await op(mod) : 'require'
    return { name: entry.name, ok: true, op: done }
  } catch (error) {
    return { name: entry.name, ok: false, op: op ? 'exercise' : 'require', error: String(error?.stack ?? error) }
  }
}

async function main() {
  const list = JSON.parse(process.argv[LIST_ARG_INDEX] ?? '[]')
  const results = []
  for (const entry of list) results.push(await probe(entry))
  const ok = results.every((r) => r.ok)
  process.stdout.write(`${JSON.stringify({ ok, results })}\n`)
  process.exit(ok ? 0 : 1)
}

main()
