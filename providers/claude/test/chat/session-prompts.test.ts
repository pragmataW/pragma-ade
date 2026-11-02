import { describe, expect, it } from 'vitest'
import {
  FAKE_PLAN,
  FAKE_PLAN_ID,
  FAKE_QUESTION,
  FAKE_QUESTION_ID,
  FAKE_QUESTION_INPUT,
} from '../../testing/fake-claude-stream/scenario'
import { isKind, readReport, startSession } from './support'

const responseFor = (home: { report: string }, id: string) =>
  readReport(home.report)
    .at(-1)
    ?.controlResponses.find((f) => f.response.request_id === id)?.response.response

/** A session whose first turn waits on the `eventId` card. */
async function awaiting(scenario: 'ask-question' | 'plan-approve', kind: 'question' | 'plan-proposal') {
  const s = await startSession(scenario)
  await s.send('go')
  const card = await s.waitForEvent(isKind(kind))
  return { s, card }
}

describe('ClaudeChatSession prompts', () => {
  it('AskUserQuestion → question card; respond allows with answers keyed by question text', async () => {
    const { s, card } = await awaiting('ask-question', 'question')
    expect(card).toMatchObject({
      eventId: FAKE_QUESTION_ID,
      questions: [
        {
          question: FAKE_QUESTION,
          header: 'Runner',
          multiSelect: false,
          options: [{ label: 'Vitest' }, { label: 'Jest' }],
        },
        { multiSelect: true },
      ],
    })
    expect(s.events.find(isKind('permission-request'))).toBeUndefined()
    await s.session.respond(FAKE_QUESTION_ID, {
      answers: [
        { question: FAKE_QUESTION, selected: ['Vitest'] },
        { question: 'Which checks should run on commit?', selected: ['Lint', 'Types'], other: 'e2e' },
      ],
    })
    await s.waitForEvent(isKind('turn-end'))
    expect(responseFor(s.home, FAKE_QUESTION_ID)).toMatchObject({
      behavior: 'allow',
      updatedInput: {
        ...FAKE_QUESTION_INPUT,
        answers: { [FAKE_QUESTION]: 'Vitest', 'Which checks should run on commit?': 'Lint, Types, e2e' },
      },
    })
    expect(s.events.find(isKind('response-resolved'))).toEqual({
      kind: 'response-resolved',
      eventId: FAKE_QUESTION_ID,
      outcome: 'answered',
      summary: 'Vitest · Lint, Types, e2e',
    })
  })

  it('an invalid answer rejects and keeps the card open; an unknown id rejects', async () => {
    const { s } = await awaiting('ask-question', 'question')
    await expect(s.session.respond(FAKE_QUESTION_ID, { nope: true })).rejects.toThrow()
    await expect(s.session.respond('missing', { answers: [] })).rejects.toThrow()
    expect(s.events.find(isKind('response-resolved'))).toBeUndefined()
  })

  it('interrupt cancels an open question (deny + response-resolved cancelled)', async () => {
    const { s } = await awaiting('ask-question', 'question')
    await s.session.interrupt()
    expect(await s.waitForEvent(isKind('response-resolved'))).toMatchObject({ outcome: 'cancelled' })
    await s.waitForEvent(isKind('turn-end'))
    expect(responseFor(s.home, FAKE_QUESTION_ID)).toMatchObject({ behavior: 'deny' })
  })

  it('ExitPlanMode → plan-proposal with the plan; approve sets the chosen mode and re-emits options', async () => {
    const { s, card } = await awaiting('plan-approve', 'plan-proposal')
    expect(card).toEqual({
      kind: 'plan-proposal',
      eventId: FAKE_PLAN_ID,
      plan: FAKE_PLAN,
      modes: ['acceptEdits', 'auto', 'default'],
    })
    await s.session.respond(FAKE_PLAN_ID, { approve: true, mode: 'acceptEdits' })
    await s.waitForEvent(isKind('turn-end'))
    expect(responseFor(s.home, FAKE_PLAN_ID)).toMatchObject({
      behavior: 'allow',
      updatedPermissions: [{ type: 'setMode', mode: 'acceptEdits', destination: 'session' }],
    })
    expect(s.report()?.controlRequests.map((f) => f.request)).toContainEqual(
      expect.objectContaining({ subtype: 'set_permission_mode', mode: 'acceptEdits' }),
    )
    expect(s.session.describeOptions().find((o) => o.key === 'permissionMode')?.current).toBe('acceptEdits')
  })

  it('rejecting a plan denies with the feedback and summarizes it', async () => {
    const { s } = await awaiting('plan-approve', 'plan-proposal')
    await s.session.respond(FAKE_PLAN_ID, { approve: false, feedback: 'Also update the docs' })
    await s.waitForEvent(isKind('turn-end'))
    expect(responseFor(s.home, FAKE_PLAN_ID)).toMatchObject({
      behavior: 'deny',
      message: expect.stringContaining('Also update the docs'),
    })
    expect(s.events.find(isKind('response-resolved'))).toMatchObject({ summary: 'Also update the docs' })
  })
})
