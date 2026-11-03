import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent, type ChatSessionStatus } from '../../../src/contract'
import { defaultChatUi } from '../../../src/renderer/kit/default-ui'
import { useTasksPanelStore } from '../../../src/renderer/kit/tasks/store'
import { ChatSessionView } from '../../../src/renderer/view/ChatView'
import {
  callsOf,
  installJsdomLayout,
  makeEnvelope,
  makeSession,
  makeTranscript,
  stubChatHost,
  TEST_SESSION_ID,
} from '../../../testing'
import { expectClampToggle, HUGE_TEXT, HUGE_TOKEN } from '../parts/long-text'
import { actions, childText, result, task, taskCall } from '../parts/samples'
import { renderChat } from '../support'
import { TASKS_SCENARIO } from './fixture'

const ID = CHAT_TESTIDS
const scrollIntoView = vi.fn()
beforeEach(() => {
  scrollIntoView.mockClear()
  Element.prototype.scrollIntoView = scrollIntoView
})
afterEach(() => vi.useRealTimers())

/** The chat view with the kit's default UI (Tasks indicator in the header, Tasks panel as side panel). */
async function renderTasksChat(events: ChatEvent[] = TASKS_SCENARIO, status: ChatSessionStatus = 'working') {
  const host = stubChatHost({ chatUi: () => defaultChatUi })
  host.snapshots.set(TEST_SESSION_ID, { providerId: 'fake', transcript: makeTranscript(events), status })
  renderChat(<ChatSessionView session={makeSession({ providerId: 'fake' })} active />, host)
  await screen.findByTestId(ID.view)
  let seq = events.length
  const emit = (e: ChatEvent) => act(() => host.emitEvent(makeEnvelope(e, ++seq)))
  return { host, emit, user: userEvent.setup() }
}

const panel = () => screen.getByTestId(ID.tasksPanel)
const rows = () => within(panel()).getAllByTestId(ID.tasksRow)
const rowIds = () => rows().map((r) => r.getAttribute('data-item-id'))
const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByTestId(ID.tasksIndicator))
  return panel()
}

describe('TasksIndicator', () => {
  it('shows live counts with a workflow mark; hidden without tasks', async () => {
    const { emit } = await renderTasksChat([])
    expect(screen.queryByTestId(ID.tasksIndicator)).toBeNull()
    emit(task({ taskKind: 'workflow', name: 'release' }))
    const pill = await screen.findByTestId(ID.tasksIndicator)
    expect(pill).toHaveTextContent('1 running')
    expect(pill).toHaveAttribute('aria-pressed', 'false')
    emit(task({ taskId: 'b', toolCallId: 'tb', status: 'completed' }))
    expect(pill).toHaveTextContent('1 running · 1 done')
  })

  it('pulses when a new task starts, then settles', async () => {
    const { emit } = await renderTasksChat([task()])
    const pill = await screen.findByTestId(ID.tasksIndicator)
    expect(pill).not.toHaveAttribute('data-pulse')
    vi.useFakeTimers()
    emit(task({ taskId: 'b', toolCallId: 'tb' }))
    expect(pill).toHaveAttribute('data-pulse', 'true')
    act(() => vi.runAllTimers())
    expect(pill).not.toHaveAttribute('data-pulse')
  })

  it('toggles the panel (pressed while open); the state survives a remount of the view', async () => {
    const { user } = await renderTasksChat()
    await openPanel(user)
    expect(screen.getByTestId(ID.tasksIndicator)).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByTestId(ID.tasksIndicator))
    expect(screen.queryByTestId(ID.tasksPanel)).toBeNull()
    act(() => useTasksPanelStore.getState().toggle(TEST_SESSION_ID))
    expect(panel()).toBeInTheDocument()
  })
})

describe('TasksPanel list', () => {
  it('groups Running / Waiting / Finished with nested subagents under their workflow', async () => {
    const { user } = await renderTasksChat()
    await openPanel(user)
    const running = screen.getByTestId(ID.tasksSection('running'))
    expect(
      within(running)
        .getAllByTestId(ID.tasksRow)
        .map((r) => [r.dataset.itemId, r.dataset.depth]),
    ).toEqual([
      ['wf', '0'],
      ['t1', '1'],
      ['t2', '1'],
      ['t3', '2'],
    ])
    expect(within(screen.getByTestId(ID.tasksSection('waiting'))).getByText('Review')).toBeInTheDocument()
    expect(within(screen.getByTestId(ID.tasksSection('finished'))).getByText('lint')).toBeInTheDocument()
    const plan = rows().find((r) => r.dataset.itemId === 't2') as HTMLElement
    expect(plan).toHaveTextContent('18.4K tokens · $0.05 · 7 tool uses · Last: Grep')
  })

  it('elapsed time ticks for running tasks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: 0 })
    const { user } = await renderTasksChat([task()])
    await openPanel(user)
    const before = rows()[0]?.textContent
    act(() => vi.advanceTimersByTime(5000))
    expect(rows()[0]?.textContent).not.toBe(before)
    expect(rows()[0]).toHaveTextContent(/\d+m \d{2}s|\d+s/)
  })

  it.each([
    ['workflows', ['wf']],
    ['running', ['wf', 't2', 't3', 't4']],
    ['subagents', ['wf', 't1', 't2', 't3', 't4']],
  ])('filter %s', async (filter, expected) => {
    const { user } = await renderTasksChat()
    await openPanel(user)
    await user.click(screen.getByTestId(ID.tasksFilter(filter)))
    expect(screen.getByTestId(ID.tasksFilter(filter))).toHaveAttribute('aria-pressed', 'true')
    expect(rowIds()).toEqual(expected)
  })

  it('search by name keeps the ancestors; no match shows the empty state', async () => {
    const { user } = await renderTasksChat()
    await openPanel(user)
    await user.type(screen.getByTestId(ID.tasksSearch), 'grep')
    expect(rowIds()).toEqual(['wf', 't2', 't3'])
    await user.type(screen.getByTestId(ID.tasksSearch), 'zzz')
    expect(screen.getByTestId(ID.tasksEmpty)).toHaveTextContent('No tasks match')
  })

  it('without tasks the panel explains what will appear', async () => {
    await renderTasksChat([])
    act(() => useTasksPanelStore.getState().toggle(TEST_SESSION_ID))
    expect(screen.getByTestId(ID.tasksEmpty)).toHaveTextContent('No subagents or workflows yet')
  })

  it('Esc closes the panel (and does not interrupt the agent); the close button too', async () => {
    const { user, host } = await renderTasksChat()
    await openPanel(user)
    rows()[0]?.focus()
    await user.keyboard('{Escape}')
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId(ID.tasksPanel)).toBeNull()
    expect(callsOf(host, 'interrupt')).toEqual([])
    await openPanel(user)
    await user.click(screen.getByTestId(ID.tasksPanelClose))
    expect(screen.queryByTestId(ID.tasksPanel)).toBeNull()
  })

  it('docks with a resize handle (arrow keys, clamped) when the chat keeps its minimum width', async () => {
    installJsdomLayout({ width: 900, height: 800 })
    onTestFinished(() => installJsdomLayout())
    const { user } = await renderTasksChat()
    act(() => useTasksPanelStore.getState().patch(TEST_SESSION_ID, { width: 300 }))
    await openPanel(user)
    expect(panel()).toHaveStyle({ width: '300px' })
    expect(panel()).not.toHaveAttribute('data-overlay')
    screen.getByTestId(ID.tasksPanelResize).focus()
    await user.keyboard('{ArrowLeft}')
    expect(useTasksPanelStore.getState().views[TEST_SESSION_ID]?.width).toBe(324)
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(useTasksPanelStore.getState().views[TEST_SESSION_ID]?.width).toBe(300)
  })

  it('overlays the transcript (not the composer) when docking would squeeze the chat', async () => {
    installJsdomLayout({ width: 600, height: 800 })
    onTestFinished(() => installJsdomLayout())
    const { user } = await renderTasksChat()
    await openPanel(user)
    expect(panel()).toHaveAttribute('data-overlay', 'true')
    expect(panel().parentElement).toContainElement(screen.getByTestId(ID.messageList))
    expect(panel().parentElement).not.toContainElement(screen.getByTestId(ID.composer))
  })
})

describe('TasksPanel detail', () => {
  const select = async (id: string) => {
    const r = await renderTasksChat()
    await openPanel(r.user)
    await r.user.click(rows().find((x) => x.dataset.itemId === id) as HTMLElement)
    return { ...r, detail: screen.getByTestId(ID.taskDetail) }
  }

  it('shows the header, the prompt, the transcript and the final result; back returns to the list', async () => {
    const { user, detail } = await select('t1')
    expect(detail).toHaveTextContent('Explore')
    expect(detail).toHaveTextContent('Done')
    expect(detail).toHaveTextContent('Find the loader')
    expect(detail).toHaveTextContent('Loader is in config.ts')
    expect(within(screen.getByTestId(ID.taskDetailTranscript)).getByText('looking in src/')).toBeInTheDocument()
    expect(screen.getByTestId(ID.taskDetailResult)).toHaveTextContent('final report: config.ts')
    expect(within(detail).getByRole('button', { name: 'Copy output' })).toBeInTheDocument()
    expect(within(detail).getByText('in release')).toBeInTheDocument()
    await user.click(screen.getByTestId(ID.taskDetailBack))
    expect(screen.queryByTestId(ID.taskDetail)).toBeNull()
  })

  it('streams new output live; subtasks open their own detail; Esc goes back first', async () => {
    const { user, emit } = await select('t2')
    emit(childText('c9', 'planning step 1', 'tc2'))
    expect(within(screen.getByTestId(ID.taskDetailTranscript)).getByText('planning step 1')).toBeInTheDocument()
    // the subtask chip comes first; the nested card in the transcript has the same name
    const [chip] = within(screen.getByTestId(ID.taskDetail)).getAllByRole('button', { name: /grep-helper/ })
    await user.click(chip as HTMLElement)
    expect(screen.getByTestId(ID.taskDetail)).toHaveAttribute('data-item-id', 't3')
    screen.getByTestId(ID.taskDetailBack).focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId(ID.taskDetail)).toBeNull()
    expect(panel()).toBeInTheDocument()
  })

  it('Stop shows for a running task when the session offers stopTask and calls it', async () => {
    const host = stubChatHost({ chatUi: () => defaultChatUi })
    const events = [actions('stopTask'), ...TASKS_SCENARIO]
    host.snapshots.set(TEST_SESSION_ID, { providerId: 'fake', transcript: makeTranscript(events), status: 'working' })
    renderChat(<ChatSessionView session={makeSession({ providerId: 'fake' })} active />, host)
    const user = userEvent.setup()
    await openPanel(user)
    await user.click(rows().find((x) => x.dataset.itemId === 't2') as HTMLElement)
    // the header's Stop (the nested helper's card in the transcript has its own)
    const [stop] = within(screen.getByTestId(ID.taskDetail)).getAllByTestId(ID.taskStop)
    await user.click(stop as HTMLElement)
    expect(callsOf(host, 'action').at(-1)?.args).toEqual([TEST_SESSION_ID, { action: 'stopTask', taskId: 't2' }])
  })

  it('Show in chat opens the cards down to the task in the transcript and flashes it', async () => {
    const { user } = await select('t3')
    await user.click(screen.getByTestId(ID.taskDetailShowInChat))
    const list = screen.getByTestId(ID.messageList)
    const card = (id: string) =>
      within(list)
        .getAllByTestId(ID.part('task'))
        .find((c) => c.dataset.itemId === id)
    await waitFor(() => expect(card('t3')).toHaveAttribute('data-flash', 'true'))
    expect(card('wf')).toHaveAttribute('data-open', 'true')
    expect(card('t2')).toHaveAttribute('data-open', 'true')
    expect(scrollIntoView).toHaveBeenCalled()
  })
})

describe('TaskCard "Open in panel"', () => {
  it('opens the panel on that task (only when the chat UI has a Tasks panel)', async () => {
    const { user } = await renderTasksChat([task()])
    const card = within(screen.getByTestId(ID.messageList)).getByTestId(ID.part('task'))
    await user.click(within(card).getByTestId(ID.taskOpenInPanel))
    expect(screen.getByTestId(ID.taskDetail)).toHaveAttribute('data-item-id', 'task1')
  })
})

describe('TasksPanel with very long agent output', () => {
  const NAME = `helper-${'n'.repeat(400)}`
  const LONG: ChatEvent[] = [
    taskCall({ toolCallId: 'tcL', input: { subagent_type: 'Explore', prompt: HUGE_TEXT } }),
    task({
      taskId: 'big',
      toolCallId: 'tcL',
      name: NAME,
      description: HUGE_TOKEN,
      summary: HUGE_TEXT,
      status: 'completed',
    }),
    childText('cL', `${HUGE_TEXT}\n\n${HUGE_TOKEN}`, 'tcL'),
    result('tcL', `${HUGE_TEXT}\nend`),
  ]

  it('list rows stay one line: a long name truncates, the description too', async () => {
    const { user } = await renderTasksChat(LONG)
    const row = within(await openPanel(user)).getByTestId(ID.tasksRow)
    expect(within(row).getByText(NAME)).toHaveClass('min-w-0', 'truncate')
    expect(within(row).getByText(HUGE_TOKEN)).toHaveClass('min-w-0', 'truncate')
  })

  it('the detail keeps its size: header fixed, long texts clamped, the activity and the result scroll', async () => {
    const { user } = await renderTasksChat(LONG)
    act(() => useTasksPanelStore.getState().openTask(TEST_SESSION_ID, 'big'))
    expect(panel()).toHaveClass('flex', 'min-h-0', 'flex-col')
    expect(screen.getByTestId(ID.taskDetail)).toHaveClass('min-h-0', 'flex-1')
    expect(screen.getByTestId(ID.taskDetailBack).closest('.shrink-0')).not.toBeNull()
    const info = screen.getByTestId(ID.taskDetailInfo)
    expect(info).toHaveClass('min-h-0', 'max-h-[45%]', 'overflow-y-auto')
    await expectClampToggle(screen.getByTestId(ID.taskDetailPrompt), HUGE_TEXT, user, true)
    await expectClampToggle(screen.getByTestId(ID.taskDetailDescription), HUGE_TOKEN, user, true)
    // the prompt and the summary (it differs from the result)
    const clamped = [...info.querySelectorAll('p[data-clamped]')].map((p) => p.textContent)
    expect(clamped).toEqual([HUGE_TEXT, HUGE_TEXT])
    const activity = screen.getByTestId(ID.taskDetailTranscript)
    expect(activity).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
    expect(activity.querySelector('.wrap-break-word')).not.toBeNull()
    expect(screen.getByTestId(ID.taskDetailResult)).toHaveClass('min-h-0', 'max-h-[40%]', 'overflow-y-auto')
  })
})
