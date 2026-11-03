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

/** `parentToolUseId`: the frame comes from the subagent that tool call spawned. */
interface Nested {
  parentToolUseId?: string
}
export interface TextStep extends Nested {
  messageId: string
  text: string
  chunks?: number
  chunkDelayMs?: number
}
export interface ToolUseStep extends Nested {
  messageId: string
  id: string
  name: string
  input: Record<string, unknown>
}
export interface ToolResultStep extends Nested {
  toolUseId: string
  content: string
  isError?: boolean
  toolUseResult?: unknown
}
export type Step =
  | { emit: Record<string, unknown> }
  | { emitText: TextStep }
  | { emitThinking: TextStep }
  | { emitToolUse: ToolUseStep }
  | { emitToolResult: ToolResultStep }
  | {
      requestPermission: {
        requestId: string
        toolName: string
        input: Record<string, unknown>
        toolUseId: string
        suggestions?: unknown[]
        decisionReason?: string
        /** The subagent (task id) asking. */
        agentId?: string
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
  supportsFastMode?: boolean
  supportsAutoMode?: boolean
}
export interface FakeMcpServer {
  name: string
  status: string
  scope?: string
  error?: string
  tools?: { name: string }[]
}
export interface Scenario {
  /** false: never answer `initialize` (a wrapper that does not speak stream-json). */
  protocol?: boolean
  init?: { commands: { name: string; description: string; argumentHint: string }[]; models: FakeModel[] }
  preamble?: Step[]
  /** Answer of `mcp_status`; also listed (name + status) in `system/init`. */
  mcpServers?: FakeMcpServer[]
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
    supportsFastMode: true,
    supportsAutoMode: true,
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

/** A reply with every rich Markdown block: table, Mermaid flowchart + sequence diagram, ASCII box diagram, code. */
export const FAKE_RICH_MARKDOWN = [
  '## Cache layer review',
  '',
  'Here is what I measured across the three **storage backends** (`p95` in ms):',
  '',
  '| Backend | Region | Requests | p95 (ms) | Hit rate | Status |',
  '| :--- | :-: | ---: | --- | --- | --- |',
  '| Redis | eu-west-1 | 1,204,331 | 4.2 | 98.1% | healthy |',
  '| Memcached | us-east-2 | 884,102 | 6.8 | 91.4% | degraded |',
  '| SQLite (local) | — | 12,044 | 0.9 | 76.0% | healthy |',
  '| DynamoDB DAX | ap-south-1 | 402,977 | 11.5 | 88.7% | healthy |',
  '',
  '### Request flow',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[Client] -->|GET /item| B{Cache hit?}',
  '  B -->|yes| C[Return cached]',
  '  B -->|no| D[(Database)]',
  '  D --> E[Store in cache]',
  '  E --> C',
  '```',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  participant U as User',
  '  participant API',
  '  participant Cache',
  '  U->>API: GET /item/42',
  '  API->>Cache: lookup(42)',
  '  Cache-->>API: miss',
  '  API->>API: load from DB',
  '  API-->>U: 200 OK',
  '  Note over API,Cache: write-through on miss',
  '```',
  '',
  'The layout on disk:',
  '',
  '```',
  '┌──────────────┐     ┌──────────────┐     ┌──────────────┐',
  '│   client     │────▶│   api (8080) │────▶│   redis      │',
  '└──────────────┘     └──────┬───────┘     └──────────────┘',
  '                            │',
  '                            ▼',
  '                     ┌──────────────┐',
  '                     │  postgres    │',
  '                     └──────────────┘',
  '```',
  '',
  'And the fix:',
  '',
  '```ts',
  'export async function getItem(id: string): Promise<Item> {',
  '  const hit = await cache.get(keyOf(id))',
  '  if (hit) return JSON.parse(hit) as Item',
  '  const item = await db.items.find(id) // falls back to the database',
  '  await cache.set(keyOf(id), JSON.stringify(item), { ttl: 300 })',
  '  return item',
  '}',
  '```',
  '',
  '> **Note:** the Memcached node is behind on its eviction policy.',
  '',
  '- [x] Measure the backends',
  '- [ ] Move Memcached to `allkeys-lru`',
  '',
  '---',
  '',
  '1. Roll out the fix',
  '2. Watch the [dashboard](https://example.com/dash)',
].join('\n')
const RICH_CHUNKS = 24
const RICH_CHUNK_MS = 60

export const richMarkdownScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [[text('msg_rich_1', FAKE_RICH_MARKDOWN, RICH_CHUNKS, RICH_CHUNK_MS), done]],
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

// ── subagents, workflows, background jobs ────────────────────────────────────────────────────────────────────
export const FAKE_AGENT_TOOL_ID = 'toolu_agent_1'
export const FAKE_TASK_ID = 'a1b2c3d4e5f6'
export const FAKE_SUBAGENT_TEXT = 'The repository has a README.md and a src/ folder.'
const sys = (subtype: string, fields: Record<string, unknown>): Step => ({
  emit: { type: 'system', subtype, ...fields, uuid: `${subtype}-${String(fields.task_id ?? '')}`, session_id: 'fake' },
})
const tool = (messageId: string, id: string, name: string, input: Record<string, unknown>, parent?: string): Step => ({
  emitToolUse: { messageId, id, name, input, ...(parent ? { parentToolUseId: parent } : {}) },
})
const toolDone = (toolUseId: string, content: string, parent?: string): Step => ({
  emitToolResult: { toolUseId, content, ...(parent ? { parentToolUseId: parent } : {}) },
})
const nestedText = (messageId: string, t: string, parent: string): Step => ({
  emitText: { messageId, text: t, chunks: 2, parentToolUseId: parent },
})
const usage = (tokens: number, toolUses: number) => ({ total_tokens: tokens, tool_uses: toolUses, duration_ms: 4200 })
/** A slow beat so the UI shows the running state. */
const BEAT_MS = 400

/** The Agent call that starts `taskId` (`fields` add workflow / nesting details). */
function spawnTask(agentToolId: string, taskId: string, fields: Record<string, unknown>, parent?: string): Step[] {
  return [
    tool(
      `msg_spawn_${taskId}`,
      agentToolId,
      'Agent',
      { description: fields.description, prompt: 'List the files' },
      parent,
    ),
    sys('task_started', {
      task_id: taskId,
      tool_use_id: agentToolId,
      task_type: 'local_agent',
      is_backgrounded: false,
      spawn_depth: 1,
      ...fields,
    }),
  ]
}

const finishTask = (taskId: string, agentToolId: string, summary: string, parent?: string): Step[] => [
  sys('task_notification', {
    task_id: taskId,
    tool_use_id: agentToolId,
    status: 'completed',
    output_file: '/tmp/fake-task.output',
    summary,
    usage: usage(18_400, 3),
  }),
  toolDone(agentToolId, summary, parent),
]

export const subagentScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      text('msg_sub_0', 'I will ask a subagent to look around.', 2),
      ...spawnTask(FAKE_AGENT_TOOL_ID, FAKE_TASK_ID, { subagent_type: 'Explore', description: 'List the files' }),
      nestedText('msg_sub_1', 'Listing the repository root.', FAKE_AGENT_TOOL_ID),
      tool('msg_sub_1', 'toolu_sub_ls', 'Bash', { command: 'ls' }, FAKE_AGENT_TOOL_ID),
      toolDone('toolu_sub_ls', 'README.md\nsrc', FAKE_AGENT_TOOL_ID),
      sys('task_progress', {
        task_id: FAKE_TASK_ID,
        tool_use_id: FAKE_AGENT_TOOL_ID,
        description: 'Running ls',
        summary: 'Reading the repository root',
        usage: usage(9_800, 1),
        last_tool_name: 'Bash',
      }),
      { delayMs: BEAT_MS },
      nestedText('msg_sub_2', FAKE_SUBAGENT_TEXT, FAKE_AGENT_TOOL_ID),
      ...finishTask(FAKE_TASK_ID, FAKE_AGENT_TOOL_ID, FAKE_SUBAGENT_TEXT),
      text('msg_sub_3', 'The subagent found a README.md and a src/ folder.'),
      done,
    ],
  ],
})

export const FAKE_WORKFLOW_TASK_ID = 'wf_spec_1'
const WORKFLOW_TOOL_ID = 'toolu_workflow_1'
const WORKFLOW_CHILD_TOOL_ID = 'toolu_wf_agent_1'

/** A `spec` workflow that runs one nested subagent. */
export const workflowScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      tool('msg_wf_0', WORKFLOW_TOOL_ID, 'Workflow', { name: 'spec' }),
      sys('task_started', {
        task_id: FAKE_WORKFLOW_TASK_ID,
        tool_use_id: WORKFLOW_TOOL_ID,
        task_type: 'local_workflow',
        workflow_name: 'spec',
        description: 'Write a spec for the feature',
      }),
      ...spawnTask(
        WORKFLOW_CHILD_TOOL_ID,
        'wf_child_1',
        { subagent_type: 'Plan', description: 'Draft the spec', parent_task_id: FAKE_WORKFLOW_TASK_ID, spawn_depth: 2 },
        WORKFLOW_TOOL_ID,
      ),
      nestedText('msg_wf_1', 'Drafting the spec outline.', WORKFLOW_CHILD_TOOL_ID),
      { delayMs: BEAT_MS },
      ...finishTask('wf_child_1', WORKFLOW_CHILD_TOOL_ID, 'Spec outline drafted.', WORKFLOW_TOOL_ID),
      ...finishTask(FAKE_WORKFLOW_TASK_ID, WORKFLOW_TOOL_ID, 'The spec is ready in docs/spec.md.'),
      text('msg_wf_2', 'The spec workflow finished.'),
      done,
    ],
  ],
})

const RELEASE_TOOL_ID = 'toolu_release_1'
const EXPLORE_TOOL_ID = 'toolu_tp_explore'
const NOTES_TOOL_ID = 'toolu_tp_notes'
const PRS_TOOL_ID = 'toolu_tp_prs'
const REVIEW_TOOL_ID = 'toolu_tp_review'
const WATCH_TOOL_ID = 'toolu_tp_watch'
const progress = (taskId: string, toolId: string, lastTool: string, tokens: number, toolUses: number): Step =>
  sys('task_progress', {
    task_id: taskId,
    tool_use_id: toolId,
    usage: usage(tokens, toolUses),
    last_tool_name: lastTool,
  })

/**
 * The Tasks panel scene: a `release` workflow with two parallel subagents (one runs a nested helper), a finished
 * review subagent and a background watcher; the turn then holds (tasks still running) until interrupted.
 */
export const tasksPanelScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      text('msg_tp_0', 'I will run the release workflow and review the diff in parallel.', 2),
      tool('msg_tp_wf', RELEASE_TOOL_ID, 'Workflow', { name: 'release' }),
      sys('task_started', {
        task_id: 'tp_release',
        tool_use_id: RELEASE_TOOL_ID,
        task_type: 'local_workflow',
        workflow_name: 'release',
        description: 'Ship v1.2 to npm',
      }),
      ...spawnTask(
        EXPLORE_TOOL_ID,
        'tp_explore',
        { subagent_type: 'Explore', description: 'Find what changed since v1.1', parent_task_id: 'tp_release' },
        RELEASE_TOOL_ID,
      ),
      ...spawnTask(
        NOTES_TOOL_ID,
        'tp_notes',
        { subagent_type: 'Plan', description: 'Draft the release notes', parent_task_id: 'tp_release' },
        RELEASE_TOOL_ID,
      ),
      nestedText('msg_tp_e1', 'Comparing v1.1 with main.', EXPLORE_TOOL_ID),
      tool('msg_tp_e2', 'toolu_tp_git', 'Bash', { command: 'git log --oneline v1.1..main' }, EXPLORE_TOOL_ID),
      toolDone('toolu_tp_git', 'a1b2c3 feat: tasks panel\nd4e5f6 fix: number format', EXPLORE_TOOL_ID),
      progress('tp_explore', EXPLORE_TOOL_ID, 'Bash', 9_800, 1),
      nestedText('msg_tp_n1', 'Outlining the notes: **Features**, **Fixes**, **Upgrade notes**.', NOTES_TOOL_ID),
      ...spawnTask(
        PRS_TOOL_ID,
        'tp_prs',
        {
          subagent_type: 'general-purpose',
          description: 'Collect the merged PRs',
          parent_task_id: 'tp_notes',
          spawn_depth: 2,
        },
        NOTES_TOOL_ID,
      ),
      nestedText('msg_tp_p1', 'Searching merged pull requests.', PRS_TOOL_ID),
      tool('msg_tp_p2', 'toolu_tp_grep', 'Grep', { pattern: 'Merge pull request' }, PRS_TOOL_ID),
      progress('tp_prs', PRS_TOOL_ID, 'Grep', 4_100, 2),
      progress('tp_notes', NOTES_TOOL_ID, 'Agent', 18_400, 7),
      { delayMs: BEAT_MS },
      nestedText('msg_tp_e3', 'Two commits since v1.1: the tasks panel and a number format fix.', EXPLORE_TOOL_ID),
      ...finishTask('tp_explore', EXPLORE_TOOL_ID, 'Two commits since v1.1.', RELEASE_TOOL_ID),
      ...spawnTask(REVIEW_TOOL_ID, 'tp_review', { subagent_type: 'code-reviewer', description: 'Review the diff' }),
      nestedText('msg_tp_r1', 'No blocking issues; one naming nit in TaskList.', REVIEW_TOOL_ID),
      ...finishTask('tp_review', REVIEW_TOOL_ID, 'No blocking issues.'),
      tool('msg_tp_w', WATCH_TOOL_ID, 'Bash', { command: 'pnpm test --watch', run_in_background: true }),
      sys('task_started', {
        task_id: 'tp_watch',
        tool_use_id: WATCH_TOOL_ID,
        task_type: 'local_bash',
        is_backgrounded: true,
        description: 'pnpm test --watch',
      }),
      toolDone(WATCH_TOOL_ID, 'Command running in background with ID: tp_watch'),
      { awaitInterrupt: true },
    ],
  ],
})

export const FAKE_BACKGROUND_TASK_ID = 'bash_bg_1'
const BACKGROUND_TOOL_ID = 'toolu_bg_1'

/** `npm run dev` moved to the background; it keeps running after the turn. */
export const backgroundTaskScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      tool('msg_bg_0', BACKGROUND_TOOL_ID, 'Bash', { command: 'npm run dev', run_in_background: true }),
      sys('task_started', {
        task_id: FAKE_BACKGROUND_TASK_ID,
        tool_use_id: BACKGROUND_TOOL_ID,
        task_type: 'local_bash',
        is_backgrounded: true,
        description: 'npm run dev',
      }),
      toolDone(BACKGROUND_TOOL_ID, `Command running in background with ID: ${FAKE_BACKGROUND_TASK_ID}`),
      text('msg_bg_1', 'The dev server is running in the background.'),
      done,
    ],
  ],
})

// ── questions, plans ─────────────────────────────────────────────────────────────────────────────────────────
export const FAKE_QUESTION_ID = 'perm-question-1'
export const FAKE_QUESTION = 'Which test runner should we use?'
const QUESTION_TOOL_ID = 'toolu_question_1'
export const FAKE_QUESTION_INPUT = {
  questions: [
    {
      question: FAKE_QUESTION,
      header: 'Runner',
      multiSelect: false,
      options: [
        { label: 'Vitest', description: 'Fast, Vite-native' },
        { label: 'Jest', description: 'The classic' },
      ],
    },
    {
      question: 'Which checks should run on commit?',
      header: 'Checks',
      multiSelect: true,
      options: [
        { label: 'Lint', description: 'Biome' },
        { label: 'Types', description: 'tsc' },
        { label: 'Tests', description: 'Unit tests' },
      ],
    },
  ],
}

export const askQuestionScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      tool('msg_q_0', QUESTION_TOOL_ID, 'AskUserQuestion', FAKE_QUESTION_INPUT),
      {
        requestPermission: {
          requestId: FAKE_QUESTION_ID,
          toolName: 'AskUserQuestion',
          input: FAKE_QUESTION_INPUT,
          toolUseId: QUESTION_TOOL_ID,
        },
      },
      toolDone(QUESTION_TOOL_ID, 'Your questions have been answered.'),
      text('msg_q_1', 'Thanks, setting it up that way.'),
      done,
    ],
  ],
})

export const FAKE_PLAN_ID = 'perm-plan-1'
export const FAKE_PLAN = '## Plan\n\n1. Add a `world` line to `a.txt`.\n2. Run the tests.\n'
const PLAN_TOOL_ID = 'toolu_plan_1'

export const planApproveScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      text('msg_plan_0', 'Here is my plan.', 2),
      tool('msg_plan_0', PLAN_TOOL_ID, 'ExitPlanMode', { plan: FAKE_PLAN }),
      {
        requestPermission: {
          requestId: FAKE_PLAN_ID,
          toolName: 'ExitPlanMode',
          input: { plan: FAKE_PLAN },
          toolUseId: PLAN_TOOL_ID,
        },
      },
      toolDone(PLAN_TOOL_ID, 'User has approved your plan.'),
      text('msg_plan_1', 'Implementing the plan now.'),
      done,
    ],
  ],
})

// ── session notices ──────────────────────────────────────────────────────────────────────────────────────────
export const FAKE_MCP_SERVERS: FakeMcpServer[] = [
  { name: 'github', status: 'connected', scope: 'user', tools: [{ name: 'search' }, { name: 'issue' }] },
  { name: 'linear', status: 'needs-auth', scope: 'project' },
  { name: 'postgres', status: 'failed', scope: 'local', error: 'spawn pg-mcp ENOENT' },
]

export const mcpStatusScenario = (): Scenario => ({
  ...basicScenario(),
  mcpServers: FAKE_MCP_SERVERS,
})

/** 5 h window */
const FAKE_RESETS_AT_S = 1_893_456_000
export const rateLimitScenario = (): Scenario => ({
  init: FAKE_INIT,
  turns: [
    [
      {
        emit: {
          type: 'rate_limit_event',
          rate_limit_info: {
            status: 'allowed_warning',
            resetsAt: FAKE_RESETS_AT_S,
            rateLimitType: 'five_hour',
            unifiedWindows: { five_hour: { utilization: 0.92 } },
          },
          uuid: 'rl-1',
          session_id: 'fake',
        },
      },
      sys('api_retry', { attempt: 1, max_retries: 10, retry_delay_ms: 2000, error_status: 529, error: 'overloaded' }),
      { delayMs: BEAT_MS },
      text('msg_rl_1', 'Answer after one retry.'),
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
  subagent: subagentScenario,
  workflow: workflowScenario,
  'background-task': backgroundTaskScenario,
  'tasks-panel': tasksPanelScenario,
  'ask-question': askQuestionScenario,
  'plan-approve': planApproveScenario,
  'mcp-status': mcpStatusScenario,
  'rate-limit': rateLimitScenario,
  'rich-markdown': richMarkdownScenario,
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
