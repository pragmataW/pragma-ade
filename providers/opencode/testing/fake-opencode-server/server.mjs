// Fake OpenCode 2.x `serve` (Node built-ins only): the routes, auth, stdio lease and v2 SSE stream the chat adapter
// uses, driven by a JSON scenario. See README.md.
import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'

const ENV = {
  scenario: 'FAKE_OPENCODE_SCENARIO',
  log: 'FAKE_OPENCODE_LOG',
  logEnv: 'FAKE_OPENCODE_LOG_ENV',
  stateDir: 'FAKE_OPENCODE_STATE_DIR',
  testRoutes: 'FAKE_OPENCODE_TEST_ROUTES',
  mode: 'FAKE_OPENCODE_MODE',
  password: 'OPENCODE_SERVER_PASSWORD',
  altPassword: 'OPENCODE_PASSWORD',
}
const DEFAULT_SCENARIO = join(import.meta.dirname, 'scenarios', 'basic.json')
const LEGACY_VERSION = '1.1.36'
const BASIC_USER = 'opencode'
const DIRECTORY_HEADER = 'x-opencode-directory'
const HEARTBEAT_MS = 10_000
const EXIT_EARLY_CODE = 3
const DIE_EXIT_CODE = 1
const STATE_FILE = 'state.json'
const JSON_TYPE = { 'content-type': 'application/json' }
const SSE_TYPE = { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }
const OK = 200
const NO_CONTENT = 204
const BAD_REQUEST = 400
const UNAUTHORIZED = 401
const NOT_FOUND = 404
const CONFLICT = 409
const UNAVAILABLE = 503
const SESSION_ROUTE = /^\/api\/session\/([^/]+)(?:\/(.*))?$/
const REPLY_ROUTE = /^(permission|form)\/([^/]+)\/reply$/
const FORM_ROUTE = /^form\/([^/]+)$/
const TEST_ROUTE_PREFIX = '/__test/'
const MCP_ROUTE = /^\/api\/experimental\/mcp\/([^/]+)\/(connect|disconnect)$/
const ATTACHMENT_URI = /^(file:\/\/\/|data:)/

// ── process plumbing ──────────────────────────────────────────────────────

const mode = process.env[ENV.mode] ?? 'normal'
const modeArg = (name) => (mode.startsWith(`${name}:`) ? mode.slice(name.length + 1) : undefined)

function log(record) {
  const file = process.env[ENV.log]
  if (file) appendFileSync(file, `${JSON.stringify(record)}\n`)
}

/** A scenario file; `extends: "<name>"` inherits every top-level field it does not set. */
function readScenarioFile(file) {
  const scenario = JSON.parse(readFileSync(file, 'utf8'))
  if (!scenario.extends) return scenario
  const { extends: base, ...own } = scenario
  return { ...readScenarioFile(join(import.meta.dirname, 'scenarios', `${base}.json`)), ...own }
}

function loadScenario() {
  return readScenarioFile(process.env[ENV.scenario] || DEFAULT_SCENARIO)
}

function versionOf(scenario) {
  if (mode === 'legacy-1x') return LEGACY_VERSION
  return modeArg('version') ?? scenario.version
}

function flagValue(args, flag) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : undefined
}

function loggedEnv() {
  const names = (process.env[ENV.logEnv] ?? '').split(',').filter(Boolean)
  return Object.fromEntries(names.filter((n) => process.env[n] !== undefined).map((n) => [n, process.env[n]]))
}

export function main(argv) {
  const scenario = loadScenario()
  const serveAt = argv.indexOf('serve')
  if (serveAt >= 0) return serve(scenario, argv, argv.slice(serveAt + 1))
  if (argv.includes('--version'))
    process.stdout.write(mode === 'legacy-1x' ? `${LEGACY_VERSION}\n` : `opencode v${versionOf(scenario)}\n`)
}

function serve(scenario, argv, flags) {
  const passwordSet = Boolean(process.env[ENV.password] || process.env[ENV.altPassword])
  log({ kind: 'start', pid: process.pid, argv, cwd: process.cwd(), env: loggedEnv(), passwordSet })
  if (mode === 'exit-early') {
    process.stderr.write('boom\n')
    process.exit(EXIT_EARLY_CODE)
  }
  const stdio = flags.includes('--stdio') && mode !== 'legacy-1x'
  installLease(stdio)
  if (mode === 'no-ready') return
  const password = process.env[ENV.password] || process.env[ENV.altPassword] || randomBytes(8).toString('hex')
  const app = createApp({ scenario, password })
  const port = Number(flagValue(flags, '--port') ?? 0)
  app.server.listen(port, flagValue(flags, '--hostname') ?? '127.0.0.1', () => {
    const url = `http://127.0.0.1:${app.server.address().port}`
    app.url = url
    log({ kind: 'ready', url })
    announce({ url, stdio, passwordSet })
    const dieAfter = modeArg('die-after-ms')
    if (dieAfter) setTimeout(() => process.exit(DIE_EXIT_CODE), Number(dieAfter))
  })
}

function announce({ url, stdio, passwordSet }) {
  if (stdio) return process.stdout.write(`${JSON.stringify({ url })}\n`)
  const prefix = mode === 'legacy-1x' ? 'opencode ' : ''
  process.stdout.write(`${prefix}server listening on ${url}\n`)
  if (!passwordSet) process.stdout.write('server password (generated)\n')
}

function installLease(stdio) {
  if (mode === 'ignore-lease') {
    process.on('SIGTERM', () => undefined)
    process.stdin.resume()
    return
  }
  if (!stdio) return
  process.stdin.on('end', () => process.exit(0))
  process.stdin.on('close', () => process.exit(0))
  process.stdin.resume()
}

// ── state ─────────────────────────────────────────────────────────────────

function createStore() {
  const dir = process.env[ENV.stateDir]
  const file = dir ? join(dir, STATE_FILE) : undefined
  const data = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { sessions: {} }
  return {
    data,
    save() {
      if (!file) return
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, JSON.stringify(data))
    },
  }
}

const newId = (prefix) => `${prefix}_${randomBytes(6).toString('hex')}`

// ── app ───────────────────────────────────────────────────────────────────

function createApp({ scenario, password }) {
  const store = createStore()
  const sse = new Set()
  const runs = new Map()
  let seq = 0
  const app = { url: '', server: null }
  const expectedAuth = `Basic ${Buffer.from(`${BASIC_USER}:${password}`).toString('base64')}`

  const broadcast = (type, data) => {
    const frame = `data: ${JSON.stringify({ id: `evt_${++seq}`, created: Date.now(), type, data })}\n\n`
    for (const res of sse) res.write(frame)
  }
  const mcp = scenario.mcp ? JSON.parse(JSON.stringify(scenario.mcp)) : undefined
  const ctx = { scenario, store, broadcast, runs, sse, holdSseUntil: 0, mcp }
  app.server = createServer((req, res) => {
    readBody(req).then((body) => {
      const url = new URL(req.url ?? '/', 'http://fake')
      const query = Object.fromEntries(url.searchParams)
      const directory = req.headers[DIRECTORY_HEADER]
      log({
        kind: 'request',
        method: req.method,
        path: url.pathname,
        query,
        body,
        directoryHeader: directory ? decodeURIComponent(String(directory)) : null,
      })
      const testRoute = url.pathname.startsWith(TEST_ROUTE_PREFIX)
      if (!testRoute && req.headers.authorization !== expectedAuth)
        return send(res, UNAUTHORIZED, { error: 'unauthorized' })
      route(ctx, { req, res, path: url.pathname, query, body, app })
    })
  })
  return app
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (d) => {
      raw += d
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : null)
      } catch {
        resolve(raw)
      }
    })
  })
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status)
    return res.end()
  }
  res.writeHead(status, JSON_TYPE)
  res.end(JSON.stringify(body))
}

const located = (data) => ({ location: { directory: process.cwd() }, data })

function route(ctx, r) {
  const { req, res, path } = r
  const key = `${req.method} ${path}`
  if (mode === 'legacy-1x') return legacyRoute(res, key)
  switch (key) {
    case 'GET /api/info':
      return send(res, OK, {
        version: versionOf(ctx.scenario),
        pid: process.pid,
        urls: [r.app.url],
        paths: { tmp: '' },
      })
    case 'GET /api/model':
      return send(res, OK, located(ctx.scenario.models))
    case 'GET /api/model/default':
      return send(res, OK, located(ctx.scenario.models.find((m) => m.id === ctx.scenario.defaultModel) ?? null))
    case 'GET /api/agent':
      return send(res, OK, located(ctx.scenario.agents))
    case 'GET /api/command':
      return send(res, OK, located(ctx.scenario.commands))
    case 'GET /api/provider':
    case 'GET /api/integration':
      return listRoute(res, ctx.scenario[path === '/api/provider' ? 'providers' : 'integrations'])
    case 'GET /api/mcp':
      return listRoute(res, ctx.mcp)
    case 'POST /api/session':
      return send(res, OK, { data: createSession(ctx, r.body ?? {}) })
    case 'GET /api/session/active':
      return send(res, OK, { data: Object.fromEntries([...ctx.runs.keys()].map((id) => [id, { type: 'running' }])) })
    case 'GET /api/event':
      return openSse(ctx, req, res)
    case 'POST /__test/drop-sse':
      return dropSse(ctx, res)
    case 'POST /__test/broadcast':
      if (process.env[ENV.testRoutes] !== '1') return send(res, NOT_FOUND, { error: 'not found' })
      ctx.broadcast(r.body?.type, r.body?.data ?? {})
      return send(res, NO_CONTENT)
    default:
      return MCP_ROUTE.test(path) ? mcpRoute(ctx, r) : sessionRoute(ctx, r)
  }
}

/** `POST /api/experimental/mcp/<name>/connect|disconnect`: connected / disabled, then `mcp.status.changed`. */
function mcpRoute(ctx, r) {
  const [, name, action] = MCP_ROUTE.exec(r.path)
  const server = ctx.mcp?.find((m) => m.name === decodeURIComponent(name))
  if (!server) return send(r.res, NOT_FOUND, { error: 'McpNotFound' })
  server.status = { status: action === 'connect' ? 'connected' : 'disabled' }
  ctx.broadcast('mcp.status.changed', { server: server.name })
  return send(r.res, NO_CONTENT)
}

/** A scenario list (`providers`, `integrations`); 404 like an older server when the scenario has none. */
function listRoute(res, list) {
  return list ? send(res, OK, located(list)) : send(res, NOT_FOUND, { error: 'not found' })
}

function legacyRoute(res, key) {
  if (key === 'GET /global/health') return send(res, OK, { healthy: true, version: LEGACY_VERSION })
  return send(res, NOT_FOUND, { error: 'not found' })
}

function openSse(ctx, req, res) {
  if (Date.now() < ctx.holdSseUntil) return send(res, UNAVAILABLE, { error: 'held' })
  res.writeHead(OK, SSE_TYPE)
  res.write(`data: ${JSON.stringify({ id: 'evt_connected', type: 'server.connected', data: {} })}\n\n`)
  ctx.sse.add(res)
  const beat = setInterval(() => res.write(': heartbeat\n\n'), HEARTBEAT_MS)
  beat.unref()
  req.on('close', () => {
    clearInterval(beat)
    ctx.sse.delete(res)
  })
}

function dropSse(ctx, res) {
  if (process.env[ENV.testRoutes] !== '1') return send(res, NOT_FOUND, { error: 'not found' })
  for (const s of ctx.sse) s.destroy()
  ctx.sse.clear()
  ctx.holdSseUntil = Date.now() + Number(new URL(res.req.url, 'http://fake').searchParams.get('holdMs') ?? 0)
  return send(res, NO_CONTENT)
}

function createSession(ctx, body) {
  const info = { id: newId('ses'), agent: body.agent, model: body.model, cost: 0, title: '' }
  ctx.store.data.sessions[info.id] = { info, messages: [], turns: 0 }
  ctx.store.save()
  return info
}

function sessionRoute(ctx, r) {
  const m = SESSION_ROUTE.exec(r.path)
  const session = m ? ctx.store.data.sessions[decodeURIComponent(m[1])] : undefined
  if (!session) return send(r.res, NOT_FOUND, { error: 'SessionNotFound' })
  const sub = m[2] ?? ''
  const key = `${r.req.method} ${sub}`
  switch (key) {
    case 'GET ':
      return send(r.res, OK, { data: session.info })
    case 'POST prompt':
      return prompt(ctx, r, session)
    case 'POST command':
      startTurn(ctx, session, r.body?.text ?? '')
      return send(r.res, NO_CONTENT)
    case 'POST interrupt':
      return send(r.res, OK, { interrupted: interrupt(ctx, session) })
    case 'POST model':
      session.info.model = r.body?.model
      return send(r.res, NO_CONTENT)
    case 'POST agent':
      session.info.agent = r.body?.agent
      return send(r.res, NO_CONTENT)
    case 'GET message':
      return send(r.res, OK, listMessages(session, r.query))
    case 'POST revert/stage':
      return stageRevert(ctx, r, session)
    case 'POST revert/commit':
      return commitRevert(ctx, r, session)
    case 'DELETE revert':
      session.revert = undefined
      return send(r.res, NO_CONTENT)
    case 'POST fork':
      return send(r.res, OK, { data: forkSession(ctx, session, r.body?.before) })
    default:
      return interactionRoute(ctx, r, session, sub)
  }
}

const messageIndex = (session, id) => session.messages.findIndex((m) => m.id === id)

/** Stages a revert to before the user message `messageID` (the scenario's `revertFiles` are "restored"). */
function stageRevert(ctx, r, session) {
  if (messageIndex(session, r.body?.messageID) < 0) return send(r.res, NOT_FOUND, { error: 'MessageNotFound' })
  session.revert = { messageID: r.body.messageID, files: (ctx.scenario.revertFiles ?? []).map((file) => ({ file })) }
  return send(r.res, OK, { data: session.revert })
}

/** Drops the staged message and everything after it. */
function commitRevert(ctx, r, session) {
  if (!session.revert) return send(r.res, CONFLICT, { error: 'NothingStaged' })
  session.messages = session.messages.slice(0, messageIndex(session, session.revert.messageID))
  session.revert = undefined
  ctx.store.save()
  return send(r.res, NO_CONTENT)
}

/** A copy of the session (up to before message `before`, else all of it). */
function forkSession(ctx, session, before) {
  const at = before ? messageIndex(session, before) : -1
  const messages = at >= 0 ? session.messages.slice(0, at) : [...session.messages]
  const info = { ...session.info, id: newId('ses'), fork: { sessionID: session.info.id } }
  ctx.store.data.sessions[info.id] = { info, messages, turns: session.turns }
  ctx.store.save()
  return info
}

function interactionRoute(ctx, r, session, sub) {
  const run = ctx.runs.get(session.info.id)
  const reply = REPLY_ROUTE.exec(sub)
  if (r.req.method === 'POST' && reply) {
    const waiter = run?.waiting.get(`${reply[1]}:${reply[2]}`)
    if (!waiter) return send(r.res, NOT_FOUND, { error: 'NotFound' })
    waiter({ reply: reply[1] === 'permission' ? r.body?.decision : r.body?.answer })
    return send(r.res, NO_CONTENT)
  }
  const form = FORM_ROUTE.exec(sub)
  if (r.req.method === 'DELETE' && form) {
    const waiter = run?.waiting.get(`form:${form[1]}`)
    if (!waiter) return send(r.res, NOT_FOUND, { error: 'FormNotFound' })
    waiter({ cancelled: true, message: r.query.message })
    return send(r.res, NO_CONTENT)
  }
  return send(r.res, NOT_FOUND, { error: 'not found' })
}

function prompt(ctx, r, session) {
  const files = r.body?.files ?? []
  if (files.some((f) => !ATTACHMENT_URI.test(String(f.uri))))
    return send(r.res, BAD_REQUEST, { error: 'Invalid attachment URI' })
  const user = startTurn(ctx, session, r.body?.text ?? '', files)
  return send(r.res, OK, { data: user })
}

function listMessages(session, query) {
  const filtered = query.type ? session.messages.filter((m) => m.type === query.type) : session.messages
  const ordered = query.order === 'desc' ? [...filtered].reverse() : filtered
  const offset = Number(query.cursor ?? 0)
  const limit = Number(query.limit ?? ordered.length)
  const next = offset + limit < ordered.length ? String(offset + limit) : null
  return { data: ordered.slice(offset, offset + limit), cursor: { next, previous: null } }
}

// ── turns ─────────────────────────────────────────────────────────────────

function startTurn(ctx, session, text, files = []) {
  const sid = session.info.id
  const user = { id: newId('msg'), type: 'user', text, files: files.map(fileOf), time: { created: Date.now() } }
  session.messages.push(user)
  ctx.store.save()
  ctx.broadcast('session.inbox.enqueued', { sessionID: sid, inboxID: user.id })
  const turns = ctx.scenario.turns
  const turn = turns[session.turns % turns.length]
  session.turns += 1
  const run = { waiting: new Map(), interrupted: false, wake: () => undefined }
  ctx.runs.set(sid, run)
  setImmediate(() => void runTurn(ctx, session, turn, run))
  return user
}

const fileOf = (f) => ({ data: '', mime: f.mime ?? mimeOf(f.uri), name: f.name, source: f.source ?? { type: 'uri' } })
const mimeOf = (uri) =>
  String(uri).startsWith('data:') ? String(uri).slice('data:'.length).split(';')[0] : 'text/plain'

async function runTurn(ctx, session, turn, run) {
  const sid = session.info.id
  const amid = newId('msg')
  const assistant = { id: amid, type: 'assistant', content: [], time: { created: Date.now() } }
  const fill = (v) => JSON.parse(JSON.stringify(v).replaceAll('$SID', sid).replaceAll('$AMID', amid))
  const emit = (type, data) => {
    if (type === 'session.created') registerChild(ctx, data)
    else if (data.sessionID === sid) record(assistant, type, data)
    ctx.broadcast(type, data)
  }
  emit('session.execution.started', { sessionID: sid })
  let outcome = 'succeeded'
  for (const step of turn.steps) {
    if (run.interrupted) break
    const result = await runStep({ step: fill(step), sid, run, emit })
    if (result === 'stop') {
      outcome = 'failed'
      break
    }
    if (step.emit?.type === 'session.execution.failed') outcome = 'failed'
  }
  if (run.interrupted) {
    outcome = 'interrupted'
    emit('session.execution.interrupted', { sessionID: sid, reason: 'user' })
  }
  finishTurn(ctx, session, assistant, outcome)
}

/** A scripted subagent's child session (so its routes, e.g. interrupt, answer). */
function registerChild(ctx, data) {
  const info = { id: data.sessionID, parentID: data.parentID, agent: data.agent, title: data.title ?? '', cost: 0 }
  ctx.store.data.sessions[info.id] ??= { info, messages: [], turns: 0 }
  ctx.store.save()
}

function finishTurn(ctx, session, assistant, outcome) {
  if (assistant.model) session.messages.push(assistant)
  session.messages.push({ id: newId('msg'), type: 'idle', outcome, time: { created: Date.now() } })
  ctx.runs.delete(session.info.id)
  ctx.store.save()
}

function record(assistant, type, data) {
  const tool = (id) => assistant.content.find((c) => c.type === 'tool' && c.id === id)
  switch (type) {
    case 'session.step.started':
      assistant.model = data.model
      return
    case 'session.text.ended':
      return void assistant.content.push({ type: 'text', text: data.text })
    case 'session.reasoning.ended':
      return void assistant.content.push({ type: 'reasoning', text: data.text })
    case 'session.tool.input.started':
      return void assistant.content.push({
        type: 'tool',
        id: data.id,
        name: data.name,
        state: { status: 'pending', input: {} },
      })
    case 'session.tool.called':
      if (tool(data.id)) tool(data.id).state = { status: 'running', input: data.input }
      return
    case 'session.tool.success':
    case 'session.tool.failed':
      return settle(tool(data.id), type, data)
    case 'session.step.ended':
      assistant.tokens = data.tokens
      assistant.cost = data.cost
      return
    default:
      return
  }
}

function settle(tool, type, data) {
  if (!tool) return
  const input = tool.state.input
  tool.state =
    type === 'session.tool.success'
      ? { status: 'completed', input, content: data.content, metadata: data.metadata }
      : { status: 'error', input, error: data.error, metadata: data.metadata }
}

function sleep(ms, run) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms)
    run.wake = () => {
      clearTimeout(t)
      resolve()
    }
  })
}

function waitFor(run, key) {
  return new Promise((resolve) => {
    run.waiting.set(key, (v) => {
      run.waiting.delete(key)
      resolve(v)
    })
  })
}

async function runStep({ step, sid, run, emit }) {
  if (step.emit) return emit(step.emit.type, step.emit.data)
  if (step.sleepMs) return sleep(step.sleepMs, run)
  if (step.awaitPermission) return awaitPermission(step.awaitPermission, { sid, run, emit })
  if (step.awaitForm) return awaitForm(step.awaitForm, { sid, run, emit })
  return undefined
}

async function awaitPermission(p, { sid, run, emit }) {
  emit('permission.asked', { ...p, sessionID: sid })
  const r = await waitFor(run, `permission:${p.id}`)
  if (run.interrupted) return undefined
  emit('permission.replied', { sessionID: sid, requestID: p.id, reply: r.reply })
  if (r.reply !== 'reject') return undefined
  emit('session.execution.failed', { sessionID: sid, error: { type: 'PermissionRejected', message: 'rejected' } })
  return 'stop'
}

async function awaitForm(f, { sid, run, emit }) {
  emit('form.created', { form: { ...f, sessionID: sid } })
  const r = await waitFor(run, `form:${f.id}`)
  if (r.cancelled) log({ kind: 'form-cancel', formId: f.id, message: r.message ?? null })
  if (run.interrupted) return undefined
  if (r.cancelled) return emit('form.cancelled', { sessionID: sid, id: f.id })
  return emit('form.replied', { sessionID: sid, id: f.id, answer: r.reply })
}

function interrupt(ctx, session) {
  const run = ctx.runs.get(session.info.id)
  if (!run) return false
  run.interrupted = true
  for (const waiter of [...run.waiting.values()]) waiter({ reply: 'reject', cancelled: true })
  run.wake()
  return true
}
