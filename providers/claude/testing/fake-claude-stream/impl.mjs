// MIT License — Copyright (c) 2026 Lovecast Inc. (stablyai/orca)
// Derived from orca src/main/claude/__fixtures__/claude-agent-sdk-scripted-cli.mjs.
// Modified for Pragma ADE: scripted turns (one per user frame), streaming text/thinking/tool helpers, permission
// round-trips, interrupts, a JSONL report and a resumable transcript under $CLAUDE_CONFIG_DIR/projects.
import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const env = process.env
const argv = process.argv.slice(2)
const VERSION = '2.1.316 (Claude Code)'
const MODEL = 'claude-fake-1'
const REPORTED_ENV = /^(HOME|CLAUDE_CONFIG_DIR|FAKE_.*|PRAGMA_.*|PROFILE_.*|PATH)$/

if (argv.includes('--version')) {
  process.stdout.write(`${VERSION}\n`)
  process.exit(0)
}

/** `--name value` or `--name=value` (the SDK uses the latter). */
const flag = (name) => {
  const inline = argv.find((a) => a.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const at = argv.indexOf(name)
  return at >= 0 ? argv[at + 1] : undefined
}
const scenario = env.FAKE_CLAUDE_SCENARIO ? JSON.parse(readFileSync(env.FAKE_CLAUDE_SCENARIO, 'utf8')) : { turns: [] }
const sessionId = flag('--session-id') ?? flag('--resume') ?? randomUUID()
const report = {
  pid: process.pid,
  startedAt: Date.now(),
  argv,
  cwd: process.cwd(),
  env: Object.fromEntries(Object.entries(env).filter(([k]) => REPORTED_ENV.test(k))),
  sessionId,
  userMessages: [],
  controlRequests: [],
  controlResponses: [],
  results: [],
}
const writeReport = () => {
  if (env.FAKE_CLAUDE_REPORT) appendFileSync(env.FAKE_CLAUDE_REPORT, `${JSON.stringify(report)}\n`)
}
writeReport()

// ── transcript ($CLAUDE_CONFIG_DIR/projects/<sanitized cwd>/<session>.jsonl) ──────────────────────────────────
const configDir = env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
const projectDir = join(configDir, 'projects', process.cwd().replace(/[^a-zA-Z0-9]/g, '-'))
const transcriptPath = join(projectDir, `${sessionId}.jsonl`)
let lastUuid = null
if (existsSync(transcriptPath)) {
  const lines = readFileSync(transcriptPath, 'utf8').trim().split('\n').filter(Boolean)
  lastUuid = lines.length > 0 ? JSON.parse(lines[lines.length - 1]).uuid : null
}
function record(type, message, uuid, extra = {}) {
  mkdirSync(projectDir, { recursive: true })
  const entry = {
    parentUuid: lastUuid,
    isSidechain: false,
    userType: 'external',
    cwd: process.cwd(),
    sessionId,
    version: VERSION,
    type,
    message,
    uuid,
    timestamp: new Date().toISOString(),
    ...extra,
  }
  appendFileSync(transcriptPath, `${JSON.stringify(entry)}\n`)
  lastUuid = uuid
}

// ── output ──────────────────────────────────────────────────────────────────────────────────────────────────
const write = (frame) => process.stdout.write(`${JSON.stringify(frame)}\n`)
const base = () => ({ uuid: randomUUID(), session_id: sessionId })
const streamEvent = (event, parent = null) =>
  write({ type: 'stream_event', event, parent_tool_use_id: parent, ...base() })
const usage = { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 30, cache_creation_input_tokens: 10 }
const blockIndex = new Map()
const nextIndex = (messageId) => {
  const k = blockIndex.get(messageId) ?? 0
  blockIndex.set(messageId, k + 1)
  return k
}

function emitAssistant(messageId, block, parent = null) {
  const frame = {
    type: 'assistant',
    message: { id: messageId, type: 'message', role: 'assistant', model: MODEL, content: [block], usage },
    parent_tool_use_id: parent,
    ...base(),
  }
  write(frame)
  record('assistant', frame.message, frame.uuid)
}

/** `parent`: the spawning tool call id when a subagent streams the block. */
async function streamBlock(messageId, start, deltas, final, chunkDelayMs, parent = null) {
  const index = nextIndex(messageId)
  const event = (e) => streamEvent(e, parent)
  if (index === 0)
    event({ type: 'message_start', message: { id: messageId, role: 'assistant', model: MODEL, content: [] } })
  event({ type: 'content_block_start', index, content_block: start })
  for (const delta of deltas) {
    if (turnAborted) return
    event({ type: 'content_block_delta', index, delta })
    if (chunkDelayMs) await sleep(chunkDelayMs)
  }
  event({ type: 'content_block_stop', index })
  emitAssistant(messageId, final, parent)
}

const chunksOf = (text, n = 1) => {
  const size = Math.max(1, Math.ceil(text.length / n))
  const out = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}

const emitText = (s) =>
  streamBlock(
    s.messageId,
    { type: 'text', text: '' },
    chunksOf(s.text, s.chunks).map((text) => ({ type: 'text_delta', text })),
    { type: 'text', text: s.text },
    s.chunkDelayMs,
    s.parentToolUseId,
  )
const emitThinking = (s) =>
  streamBlock(
    s.messageId,
    { type: 'thinking', thinking: '' },
    chunksOf(s.text, s.chunks).map((thinking) => ({ type: 'thinking_delta', thinking })),
    { type: 'thinking', thinking: s.text, signature: 'sig' },
    s.chunkDelayMs,
    s.parentToolUseId,
  )
const emitToolUse = (s) =>
  streamBlock(
    s.messageId,
    { type: 'tool_use', id: s.id, name: s.name, input: {} },
    [{ type: 'input_json_delta', partial_json: JSON.stringify(s.input) }],
    { type: 'tool_use', id: s.id, name: s.name, input: s.input },
    0,
    s.parentToolUseId,
  )

function emitToolResult(s) {
  const message = {
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: s.toolUseId, content: s.content, is_error: s.isError === true }],
  }
  const frame = { type: 'user', message, parent_tool_use_id: s.parentToolUseId ?? null, ...base() }
  if (s.toolUseResult !== undefined) frame.tool_use_result = s.toolUseResult
  write(frame)
  record('user', message, frame.uuid, s.toolUseResult === undefined ? {} : { toolUseResult: s.toolUseResult })
}

function emitResult(s = {}) {
  const subtype = s.subtype ?? 'success'
  const ok = subtype === 'success'
  const frame = {
    type: 'result',
    subtype,
    is_error: !ok,
    duration_ms: 5,
    duration_api_ms: 4,
    num_turns: 1,
    stop_reason: ok ? 'end_turn' : null,
    total_cost_usd: s.costUsd ?? 0.0042,
    usage,
    modelUsage: {
      [MODEL]: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadInputTokens: usage.cache_read_input_tokens,
        cacheCreationInputTokens: usage.cache_creation_input_tokens,
        webSearchRequests: 0,
        costUSD: s.costUsd ?? 0.0042,
        contextWindow: s.contextWindow ?? 200_000,
        maxOutputTokens: 32_000,
      },
    },
    permission_denials: [],
    ...(ok ? { result: '' } : { errors: s.errors ?? [] }),
    ...base(),
  }
  write(frame)
  report.results.push({ at: Date.now(), subtype })
  writeReport()
}

// ── input ───────────────────────────────────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const userWaiters = []
const pendingUsers = []
const responseWaiters = new Map()
let interruptWaiter = null
let interrupted = false
/** Set when an interrupt ended the current turn; stops streaming that is still in flight. */
let turnAborted = false

function reply(frame, response = {}) {
  write({ type: 'control_response', response: { subtype: 'success', request_id: frame.request_id, response } })
}

function onControlRequest(frame) {
  report.controlRequests.push(frame)
  writeReport()
  if (scenario.protocol === false) return
  const subtype = frame.request?.subtype
  if (subtype === 'initialize') return reply(frame, initResponse())
  if (subtype === 'mcp_status') return reply(frame, { mcpServers: scenario.mcpServers ?? [] })
  if (subtype === 'rewind_files') return reply(frame, { canRewind: true, filesChanged: ['README.md'] })
  reply(frame)
  if (subtype !== 'interrupt') return
  interrupted = true
  interruptWaiter?.()
  interruptWaiter = null
}

function onLine(line) {
  let frame
  try {
    frame = JSON.parse(line)
  } catch {
    return
  }
  if (frame.type === 'control_request') return onControlRequest(frame)
  if (frame.type === 'control_response') {
    report.controlResponses.push(frame)
    writeReport()
    responseWaiters.get(frame.response?.request_id)?.()
    return
  }
  if (frame.type !== 'user') return
  report.userMessages.push({ at: Date.now(), frame })
  writeReport()
  record('user', frame.message, frame.uuid ?? randomUUID())
  const waiter = userWaiters.shift()
  if (waiter) waiter()
  else pendingUsers.push(frame)
}

const nextUser = () =>
  pendingUsers.length > 0 ? Promise.resolve(pendingUsers.shift()) : new Promise((r) => userWaiters.push(r))
const interruptSignal = () =>
  new Promise((r) => {
    if (interrupted) r()
    else interruptWaiter = r
  })

function initResponse() {
  const init = scenario.init ?? {}
  return {
    commands: init.commands ?? [],
    agents: [],
    output_style: 'default',
    available_output_styles: ['default'],
    models: init.models ?? [],
    account: init.account ?? { email: 'fake@example.test' },
  }
}

const mcpInit = () =>
  scenario.mcpServers ? { mcp_servers: scenario.mcpServers.map(({ name, status }) => ({ name, status })) } : {}

// ── steps ───────────────────────────────────────────────────────────────────────────────────────────────────
const INTERRUPTED = Symbol('interrupted')
const raceInterrupt = (p) => Promise.race([p, interruptSignal().then(() => INTERRUPTED)])

function waitForResponse(requestId) {
  if (report.controlResponses.some((f) => f.response?.request_id === requestId)) return Promise.resolve()
  return new Promise((r) => responseWaiters.set(requestId, r))
}

function requestPermission(s) {
  write({
    type: 'control_request',
    request_id: s.requestId,
    request: {
      subtype: 'can_use_tool',
      tool_name: s.toolName,
      input: s.input,
      tool_use_id: s.toolUseId,
      ...(s.agentId ? { agent_id: s.agentId } : {}),
      ...(s.suggestions ? { permission_suggestions: s.suggestions } : {}),
      ...(s.decisionReason ? { decision_reason: s.decisionReason } : {}),
    },
  })
  return waitForResponse(s.requestId)
}

const STEPS = {
  emit: (v) => write(v),
  emitText,
  emitThinking,
  emitToolUse,
  emitToolResult,
  requestPermission,
  result: emitResult,
  stdoutRaw: (v) => process.stdout.write(v),
  stderr: (v) => process.stderr.write(v),
  delayMs: (v) => sleep(v),
  exit: (v) => {
    writeReport()
    process.exit(v)
  },
}

async function runStep(step) {
  if (step.awaitInterrupt) {
    await interruptSignal()
    interrupted = false
    return undefined
  }
  const [key, value] = Object.entries(step)[0] ?? []
  const run = STEPS[key]
  if (!run) throw new Error(`fake-claude: unknown step ${key}`)
  return raceInterrupt(Promise.resolve(run(value)))
}

/** Runs a turn; an interrupt outside `awaitInterrupt` ends it with an `error_during_execution` result. */
async function runTurn(steps) {
  turnAborted = false
  for (const step of steps) {
    if ((await runStep(step)) === INTERRUPTED || interrupted) {
      interrupted = false
      turnAborted = true
      emitResult({ subtype: 'error_during_execution' })
      return
    }
  }
}

const FALLBACK_TURN = [{ emitText: { messageId: 'msg_fallback', text: 'OK', chunks: 1 } }, { result: {} }]

async function main() {
  for (const step of scenario.preamble ?? []) await runStep(step)
  if (scenario.protocol === false) return
  for (let turn = 0; ; turn++) {
    await nextUser()
    if (turn === 0)
      write({ type: 'system', subtype: 'init', cwd: process.cwd(), model: MODEL, tools: [], ...mcpInit(), ...base() })
    await runTurn(scenario.turns?.[turn] ?? FALLBACK_TURN)
  }
}

createInterface({ input: process.stdin })
  .on('line', onLine)
  .on('close', () => {
    writeReport()
    process.exit(0)
  })
setTimeout(() => process.exit(3), Number(env.FAKE_CLAUDE_TIMEOUT_MS ?? 600_000)).unref()
main().catch((e) => {
  process.stderr.write(`fake-claude: ${e?.stack ?? e}\n`)
  process.exit(4)
})
