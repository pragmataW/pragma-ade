import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent, EVENT_KIND } from '../../../src/contract'
import { defaultChatUi } from '../../../src/renderer/kit/default-ui'
import { buildRows } from '../../../src/renderer/kit/parts/rows'
import { TaskCard } from '../../../src/renderer/kit/parts/TaskCard'
import { TaskTree } from '../../../src/renderer/kit/parts/TaskTree'
import { ToolCallCard } from '../../../src/renderer/kit/parts/ToolCallCard'
import { makeTranscript, stubSessionApi } from '../../../testing'
import { renderChat, renderPart } from '../support'
import { expectClampToggle, HUGE_TEXT } from './long-text'
import { actions, childText, result, task, taskCall, text, tool } from './samples'

const rowKeys = (events: ChatEvent[], parts = defaultChatUi.parts) =>
  buildRows(makeTranscript(events).items, parts, { groupToolCalls: false, turnHeader: false }).map((r) => r.key)

describe('TaskCard', () => {
  it('shows name, description, live status pill and usage; the toggle is an expandable button', () => {
    renderPart(TaskCard, [task()])
    const card = screen.getByTestId(CHAT_TESTIDS.part(EVENT_KIND.task))
    expect(card).toHaveAttribute('data-status', 'running')
    expect(card).toHaveTextContent('Explore')
    expect(card).toHaveTextContent('Find the config loader')
    expect(card).toHaveTextContent('Running')
    expect(card).toHaveTextContent('Last: Grep')
    expect(card).toHaveTextContent('12.3K tokens')
    expect(screen.getByTestId(CHAT_TESTIDS.taskToggle)).toHaveAttribute('aria-expanded', 'false')
  })

  it.each([undefined, 'backgrounded'])(
    'a missing or unknown status (%s) reads a neutral label, never a raw key',
    (s) => {
      renderPart(TaskCard, [task({ status: s as never })])
      const card = screen.getByTestId(CHAT_TESTIDS.part(EVENT_KIND.task))
      expect(card).not.toHaveTextContent('task.status')
      expect(card).toHaveTextContent('Unknown')
    },
  )

  it('expanding renders the nested transcript (by task id and tool call id) with the provider parts', async () => {
    renderPart(
      TaskCard,
      [task(), childText('c1', 'looking in src/'), childText('c2', 'found it', 'task1'), text('x', 'top')],
      {
        kind: 'task',
      },
    )
    expect(screen.queryByText('looking in src/')).toBeNull()
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.taskToggle))
    const children = screen.getByTestId(CHAT_TESTIDS.taskChildren)
    expect(within(children).getByText('looking in src/')).toBeInTheDocument()
    expect(within(children).getByText('found it')).toBeInTheDocument()
    expect(within(children).queryByText('top')).toBeNull()
  })

  it('shows the summary when done and "No output yet" without children', async () => {
    renderPart(TaskCard, [task({ status: 'completed', summary: 'Loader is in config.ts' })])
    expect(screen.getByText('Loader is in config.ts')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.taskToggle))
    expect(screen.getByText('No output yet')).toBeInTheDocument()
  })

  it('a very long summary is clamped with "Show more"; a very long name truncates beside the description', async () => {
    const name = `agent-${'n'.repeat(500)}`
    renderPart(TaskCard, [task({ status: 'completed', name, summary: HUGE_TEXT })])
    await expectClampToggle(screen.getByTestId(CHAT_TESTIDS.taskSummary), HUGE_TEXT, userEvent.setup(), false)
    expect(screen.getByText(name)).toHaveClass('min-w-0', 'truncate')
  })

  it('Stop appears only for a live task when the session offers stopTask, and calls the action', async () => {
    const { unmount } = renderPart(TaskCard, [task()])
    expect(screen.queryByTestId(CHAT_TESTIDS.taskStop)).toBeNull()
    unmount()
    const live = renderPart(TaskCard, [actions('stopTask'), task()], { kind: 'task' })
    await userEvent.click(screen.getByRole('button', { name: 'Stop Explore' }))
    expect(live.callsOf('action')[0]?.args).toEqual([{ action: 'stopTask', taskId: 'task1' }])
    live.unmount()
    renderPart(TaskCard, [actions('stopTask'), task({ status: 'completed' })], { kind: 'task' })
    expect(screen.queryByTestId(CHAT_TESTIDS.taskStop)).toBeNull()
  })

  it('a workflow gets the workflow label', () => {
    renderPart(TaskCard, [task({ taskKind: 'workflow', name: 'release' })])
    expect(screen.getByTestId(CHAT_TESTIDS.part(EVENT_KIND.task))).toHaveTextContent('Workflow')
  })
})

describe('task nesting in the message list', () => {
  it('a task card replaces its tool call; nested output leaves the main list', () => {
    expect(rowKeys([taskCall(), task(), childText('c1', 'sub'), text('t', 'top')])).toEqual([
      'task:task1',
      'text-delta:t',
    ])
  })

  it('without a task part the tool call stays and still owns its (task-kind) children', () => {
    const { task: _task, ...parts } = defaultChatUi.parts
    expect(rowKeys([taskCall(), task(), childText('c1', 'sub')], parts)).toEqual(['tool-call:tc-task'])
  })

  it('orphans (parent not in the transcript) stay in the list', () => {
    expect(rowKeys([childText('c1', 'sub', 'gone')])).toEqual(['text-delta:c1'])
  })
})

describe('task tool body', () => {
  it('without a task event: the prompt, the nested transcript and the output', async () => {
    renderPart(ToolCallCard, [taskCall(), childText('c1', 'subagent says hi'), result('tc-task', 'final report')], {
      kind: 'tool-call',
    })
    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('Look for the loader')).toBeInTheDocument()
    expect(within(screen.getByTestId(CHAT_TESTIDS.taskChildren)).getByText('subagent says hi')).toBeInTheDocument()
    expect(screen.getByText('final report')).toBeInTheDocument()
  })

  it('with a task event: the task card', async () => {
    renderPart(ToolCallCard, [taskCall(), task()], { kind: 'tool-call' })
    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByTestId(CHAT_TESTIDS.part(EVENT_KIND.task))).toBeInTheDocument()
  })
})

describe('TaskTree', () => {
  it('lists every task indented by depth, with status; nothing without tasks', () => {
    const s = stubSessionApi([task(), task({ taskId: 'task2', name: 'Plan', depth: 1, status: 'failed' })])
    renderChat(<TaskTree session={s.api} />)
    const rows = screen.getAllByTestId(CHAT_TESTIDS.taskTreeRow)
    expect(rows.map((r) => r.getAttribute('data-status'))).toEqual(['running', 'failed'])
    expect(rows[1]).toHaveStyle({ paddingLeft: '12px' })
    expect(screen.getByRole('region', { name: 'Tasks' })).toBeInTheDocument()
  })

  it('renders nothing without tasks', () => {
    const { container } = renderChat(<TaskTree session={stubSessionApi([tool('1')]).api} />)
    expect(container).toBeEmptyDOMElement()
  })
})
