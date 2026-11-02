import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, EVENT_KIND } from '../../../src/contract'
import { PlanApprovalCard } from '../../../src/renderer/kit/parts/PlanApprovalCard'
import { QuestionCard } from '../../../src/renderer/kit/parts/QuestionCard'
import { stubChatHost } from '../../../testing'
import { renderPart } from '../support'
import { modes, plan, question } from './samples'

const multi = question({
  questions: [
    {
      question: 'Which checks?',
      multiSelect: true,
      options: [{ label: 'Lint' }, { label: 'Types' }, { label: 'Tests' }],
    },
  ],
})

describe('QuestionCard', () => {
  it('is a labelled region with radios, descriptions and an Other field; Submit waits for an answer', async () => {
    const { callsOf } = renderPart(QuestionCard, [question()])
    expect(screen.getByRole('region', { name: 'The agent has a question' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /Which database\?/ })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByText('Relational, scales')).toBeInTheDocument()
    const submit = screen.getByTestId(CHAT_TESTIDS.questionSubmit)
    expect(submit).toBeDisabled()
    await userEvent.click(screen.getByRole('radio', { name: /Postgres/ }))
    await userEvent.click(submit)
    expect(callsOf('respond')[0]?.args).toEqual([
      'q1',
      { answers: [{ question: 'Which database?', selected: ['Postgres'] }] },
    ])
  })

  it('keyboard: arrow keys move the single choice', async () => {
    renderPart(QuestionCard, [question()])
    await userEvent.click(screen.getByRole('radio', { name: /Postgres/ }))
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: /SQLite/ })).toBeChecked()
  })

  it('multi-select toggles checkboxes; Other text is sent alongside', async () => {
    const { callsOf } = renderPart(QuestionCard, [multi])
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lint' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tests' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Lint' }))
    await userEvent.type(screen.getByTestId(CHAT_TESTIDS.questionOther(0)), 'E2E')
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.questionSubmit))
    expect(callsOf('respond')[0]?.args[1]).toEqual({
      answers: [{ question: 'Which checks?', selected: ['Tests'], other: 'E2E' }],
    })
  })

  it('typing an Other answer replaces a single choice', async () => {
    const { callsOf } = renderPart(QuestionCard, [question()])
    await userEvent.click(screen.getByRole('radio', { name: /Postgres/ }))
    await userEvent.type(screen.getByTestId(CHAT_TESTIDS.questionOther(0)), 'DuckDB')
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.questionSubmit))
    expect(callsOf('respond')[0]?.args[1]).toEqual({
      answers: [{ question: 'Which database?', selected: [], other: 'DuckDB' }],
    })
  })

  it('resolved: inputs disabled, outcome and summary instead of Submit', () => {
    renderPart(QuestionCard, [
      question(),
      { kind: 'response-resolved', eventId: 'q1', outcome: 'answered', summary: 'Postgres' },
    ])
    expect(screen.queryByTestId(CHAT_TESTIDS.questionSubmit)).toBeNull()
    expect(screen.getByTestId(CHAT_TESTIDS.resolvedSummary)).toHaveTextContent(/Answered.*Postgres/)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
  })
})

describe('PlanApprovalCard', () => {
  it('renders the plan as Markdown and approves in the first safe mode by default', async () => {
    const { callsOf } = renderPart(PlanApprovalCard, [modes(), plan()], { kind: 'plan-proposal' })
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByText('Add the loader')).toBeInTheDocument()
    expect(screen.getByTestId(CHAT_TESTIDS.planMode('default'))).toHaveAttribute('data-state', 'on')
    expect(screen.queryByTestId(CHAT_TESTIDS.planMode('plan'))).toBeNull()
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.planApprove))
    expect(callsOf('respond')[0]?.args).toEqual(['p1', { approve: true, mode: 'default' }])
  })

  it('a requiresConfirm mode asks through the SDK dialog first; declining sends nothing', async () => {
    const host = stubChatHost({ confirm: async () => false })
    const { callsOf } = renderPart(PlanApprovalCard, [modes(), plan({ modes: ['bypass', 'acceptEdits'] })], {
      kind: 'plan-proposal',
      host,
    })
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.planMode('bypass')))
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.planApprove))
    expect(callsOf('respond')).toEqual([])
  })

  it('a confirmed dangerous mode is sent', async () => {
    const host = stubChatHost()
    const { callsOf } = renderPart(PlanApprovalCard, [modes(), plan({ modes: ['bypass'] })], {
      kind: 'plan-proposal',
      host,
    })
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.planApprove))
    expect(host.calls.find((c) => c.method === 'confirm')?.args[0]).toMatchObject({
      titleKey: 'chat:permissionMode.confirmTitle',
      params: { mode: 'Bypass' },
      destructive: true,
    })
    expect(callsOf('respond')[0]?.args[1]).toEqual({ approve: true, mode: 'bypass' })
  })

  it('Keep planning sends feedback; no modes without a permissionMode option', async () => {
    const { callsOf } = renderPart(PlanApprovalCard, [plan()])
    expect(screen.queryByTestId(CHAT_TESTIDS.planMode('default'))).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Keep planning' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Feedback for the agent' }), 'Smaller steps')
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.planReject))
    expect(callsOf('respond')[0]?.args).toEqual(['p1', { approve: false, feedback: 'Smaller steps' }])
  })

  it('resolved: no actions', () => {
    renderPart(PlanApprovalCard, [plan(), { kind: 'response-resolved', eventId: 'p1', outcome: 'cancelled' }])
    expect(screen.queryByTestId(CHAT_TESTIDS.planApprove)).toBeNull()
    expect(screen.getByTestId(CHAT_TESTIDS.part(EVENT_KIND.planProposal))).toHaveAttribute('data-resolved', 'cancelled')
  })
})
