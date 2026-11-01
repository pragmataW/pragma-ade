/** Typed scenarios for `fake-claude` (one source for unit tests and E2E; `scenarios/*.json` are generated from these). */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const FAKE_CLAUDE_ENV = {
  scenario: 'FAKE_CLAUDE_SCENARIO',
  report: 'FAKE_CLAUDE_REPORT',
  timeoutMs: 'FAKE_CLAUDE_TIMEOUT_MS',
} as const

const DIR = import.meta.dirname
/** Absolute path of the executable. */
export const fakeClaudePath = join(DIR, 'fake-claude')
export const scenariosDir = join(DIR, 'scenarios')

export interface TextStep {
  messageId: string
  text: string
  chunks?: number
  chunkDelayMs?: number
}
export type Step =
  | { emit: Record<string, unknown> }
  | { emitText: TextStep }
  | { emitThinking: TextStep }
  | { emitToolUse: { messageId: string; id: string; name: string; input: Record<string, unknown> } }
  | { emitToolResult: { toolUseId: string; content: string; isError?: boolean; toolUseResult?: unknown } }
  | {
      requestPermission: {
        requestId: string
        toolName: string
        input: Record<string, unknown>
        toolUseId: string
        suggestions?: unknown[]
        decisionReason?: string
      }
    }
  | { awaitInterrupt: true }
  | { result: { subtype?: string; costUsd?: number; contextWindow?: number; errors?: string[] } }
  | { stdoutRaw: string }
  | { stderr: string }
  | { delayMs: number }
  | { exit: number }

export interface FakeModel {
  value: string
  displayName: string
  description: string
  supportsEffort?: boolean
  supportedEffortLevels?: string[]
}
export interface Scenario {
  /** false: never answer `initialize` (a wrapper that does not speak stream-json). */
  protocol?: boolean
  init?: { commands: { name: string; description: string; argumentHint: string }[]; models: FakeModel[] }
  preamble?: Step[]
  /** Each turn first awaits the next user frame. */
  turns: Step[][]
}

export const FAKE_TEXT = {
  basic: 'Hello from fake Claude! Streaming works.',
  long: 'Working through a long answer, one slow chunk at a time.',
  second: 'Second answer after the queue.',
  edited: 'I updated the README.',
  todo: 'Plan updated.',
  compacted: 'Continuing after compaction.',
  interrupt: 'Thinking about it for a while',
  crash: 'Starting the work',
} as const
export const FAKE_STDERR = 'fatal: simulated crash in fake-claude\n'
export const FAKE_BANNER = 'dgc wrapper 1.0: starting claude\n'
export const FAKE_PLAIN_OUTPUT = 'This wrapper does not speak stream-json.\n'
export const FAKE_PERMISSION_ID = 'perm-edit-1'
export const FAKE_EDIT_TOOL_ID = 'toolu_edit_1'
export const FAKE_EDIT_INPUT = { file_path: 'README.md', old_string: '# fixture', new_string: '# fixture (edited)' }
export const FAKE_COMPACT_PRE_TOKENS = 48_000
export const FAKE_MODELS: FakeModel[] = [
  {
    value: 'default',
    displayName: 'Default (recommended)',
    description: 'Fake default',
    supportsEffort: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
  },
  { value: 'fake-opus', displayName: 'Fake Opus', description: 'Bigger fake', supportsEffort: false },
]
export const FAKE_INIT: Scenario['init'] = {
  commands: [
    { name: 'review', description: 'Review the current changes', argumentHint: '' },
    { name: 'compact', description: 'Compact the conversation', argumentHint: '[instructions]' },
  ],
  models: FAKE_MODELS,
}

const text = (messageId: string, t: string, chunks = 4, chunkDelayMs?: number): Step => ({
  emitText: { messageId, text: t, chunks, ...(chunkDelayMs ? { chunkDelayMs } : {}) },
})
const done: Step = { result: { costUsd: 0.0123, contextWindow: 200_000 } }
const interrupted: Step = { result: { subtype: 'error_during_execution' } }
/** A streamed answer slow enough for two UI observations. */
const STREAM_DELAY_MS = 250

export const basicScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [[text('msg_basic_1', FAKE_TEXT.basic, 6, STREAM_DELAY_MS), done]],
})

export const toolEditPermissionScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      { emitThinking: { messageId: 'msg_edit_1', text: 'The README needs an edit.' } },
      { emitToolUse: { messageId: 'msg_edit_1', id: FAKE_EDIT_TOOL_ID, name: 'Edit', input: FAKE_EDIT_INPUT } },
      {
        requestPermission: {
          requestId: FAKE_PERMISSION_ID,
          toolName: 'Edit',
          input: FAKE_EDIT_INPUT,
          toolUseId: FAKE_EDIT_TOOL_ID,
          suggestions: [{ type: 'addRules', rules: [{ toolName: 'Edit' }], behavior: 'allow', destination: 'session' }],
        },
      },
      { emitToolResult: { toolUseId: FAKE_EDIT_TOOL_ID, content: 'The file README.md has been updated.' } },
      text('msg_edit_2', FAKE_TEXT.edited),
      done,
    ],
  ],
})

export const todoScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      {
        emitToolUse: {
          messageId: 'msg_todo_1',
          id: 'toolu_todo_1',
          name: 'TodoWrite',
          input: {
            todos: [
              { content: 'Write the tests', status: 'completed', activeForm: 'Writing the tests' },
              { content: 'Implement the feature', status: 'in_progress', activeForm: 'Implementing' },
              { content: 'Ship it', status: 'pending', activeForm: 'Shipping' },
            ],
          },
        },
      },
      { emitToolResult: { toolUseId: 'toolu_todo_1', content: 'Todos have been modified successfully.' } },
      text('msg_todo_2', FAKE_TEXT.todo),
      done,
    ],
  ],
})

/** Turn 1 streams for ~3 s so a second message can be queued; turn 2 answers it. */
export const longTurnScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [text('msg_long_1', FAKE_TEXT.long, 10, 300), done],
    [text('msg_long_2', FAKE_TEXT.second), done],
  ],
})

const interruptTurn = (n: number): Step[] => [
  text(`msg_int_${n}`, FAKE_TEXT.interrupt),
  { awaitInterrupt: true },
  interrupted,
]
export const interruptScenario = (): Scenario => ({ init: FAKE_INIT, turns: [interruptTurn(1), interruptTurn(2)] })

export const crashScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [[text('msg_crash_1', FAKE_TEXT.crash, 1), { delayMs: 100 }, { stderr: FAKE_STDERR }, { exit: 2 }]],
})

export const notStreamJsonScenario = (): Scenario => ({
  protocol: false,
  preamble: [{ stdoutRaw: FAKE_PLAIN_OUTPUT }],
  turns: [],
})

export const exitEarlyScenario = (): Scenario => ({
  protocol: false,
  preamble: [{ stderr: 'wrapper: cannot start claude\n' }, { exit: 1 }],
  turns: [],
})

export const bannerThenProtocolScenario = (): Scenario => ({
  ...basicScenario(),
  preamble: [{ stdoutRaw: FAKE_BANNER }],
})

export const compactScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      {
        emit: {
          type: 'system',
          subtype: 'compact_boundary',
          compact_metadata: { trigger: 'auto', pre_tokens: FAKE_COMPACT_PRE_TOKENS },
          uuid: 'compact-1',
          session_id: 'fake',
        },
      },
      text('msg_compact_1', FAKE_TEXT.compacted),
      done,
    ],
  ],
})

export const SCENARIOS = {
  basic: basicScenario,
  'tool-edit-permission': toolEditPermissionScenario,
  todo: todoScenario,
  'long-turn': longTurnScenario,
  interrupt: interruptScenario,
  crash: crashScenario,
  'not-stream-json': notStreamJsonScenario,
  'exit-early': exitEarlyScenario,
  'banner-then-protocol': bannerThenProtocolScenario,
  compact: compactScenario,
} as const
export type ScenarioName = keyof typeof SCENARIOS

const JSON_INDENT = 2
export const scenarioJson = (name: ScenarioName): string => `${JSON.stringify(SCENARIOS[name](), null, JSON_INDENT)}\n`
/** Path of the committed `scenarios/<name>.json`. */
export const scenarioPath = (name: ScenarioName): string => join(scenariosDir, `${name}.json`)
export const readScenarioFile = (name: ScenarioName): string => readFileSync(scenarioPath(name), 'utf8')

/** Regenerates `scenarios/*.json` (run after editing a builder: `node providers/claude/testing/fake-claude-stream/scenario.ts`). */
export function writeScenarioFiles(): void {
  for (const name of Object.keys(SCENARIOS) as ScenarioName[]) writeFileSync(scenarioPath(name), scenarioJson(name))
}

if (process.argv[1] === import.meta.filename) writeScenarioFiles()
