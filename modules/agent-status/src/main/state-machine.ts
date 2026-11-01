import { type AgentSessionStatus, SESSION_STATUS as S } from '@pragma/module-agents/contract'
import { type AgentStatusEvent, EVENT_KIND as K } from '../contract'

export interface TrackedState {
  status: AgentSessionStatus
  turnCompleted: boolean
  externalSessionId?: string
  detail?: string
}

export const ACTIVITY = { output: 'output', silence: 'silence' } as const
export const LIFECYCLE = { exited: 'exited', failed: 'failed' } as const
export const INPUT_SOURCE = { hook: 'hook', activity: 'activity', lifecycle: 'lifecycle' } as const

export type TrackerInput =
  | { source: typeof INPUT_SOURCE.hook; event: AgentStatusEvent }
  | { source: typeof INPUT_SOURCE.activity; kind: (typeof ACTIVITY)[keyof typeof ACTIVITY] }
  | { source: typeof INPUT_SOURCE.lifecycle; kind: (typeof LIFECYCLE)[keyof typeof LIFECYCLE] }

export const initialTrackedState: TrackedState = { status: S.starting, turnCompleted: false }

const ACTIVE_FROM = new Set<AgentSessionStatus>([S.starting, S.idle, S.working])

const withStatus = (
  state: TrackedState,
  status: AgentSessionStatus,
  patch: Partial<TrackedState> = {},
): TrackedState => ({
  ...state,
  status,
  ...patch,
})

function reduceHook(state: TrackedState, event: AgentStatusEvent): TrackedState {
  switch (event.kind) {
    case K.sessionStarted:
      return state.status === S.starting ? withStatus(state, S.idle) : state
    case K.promptSubmitted:
    case K.toolFinished:
    case K.userResponded:
      return withStatus(state, S.working, { turnCompleted: false })
    case K.toolStarted:
      return withStatus(state, S.working, { turnCompleted: false, detail: event.toolName })
    case K.waitingForUser:
      return withStatus(state, S.waiting)
    case K.turnCompleted:
      return withStatus(state, S.idle, { turnCompleted: true, detail: undefined })
    case K.turnInterrupted:
      return withStatus(state, S.idle, { turnCompleted: false, detail: undefined })
    case K.turnFailed:
      return withStatus(state, S.error, { detail: event.message })
    case K.sessionEnded:
      return state
    default: {
      const never: never = event
      return never
    }
  }
}

function reduceActivity(state: TrackedState, kind: (typeof ACTIVITY)[keyof typeof ACTIVITY]): TrackedState {
  if (kind === ACTIVITY.output) return ACTIVE_FROM.has(state.status) ? withStatus(state, S.working) : state
  return state.status === S.working ? withStatus(state, S.idle) : state
}

const withExternalId = (state: TrackedState, ext: string | undefined): TrackedState =>
  ext && ext !== state.externalSessionId ? { ...state, externalSessionId: ext } : state

function reduceInput(state: TrackedState, input: TrackerInput): TrackedState {
  switch (input.source) {
    case INPUT_SOURCE.lifecycle:
      return input.kind === LIFECYCLE.exited
        ? withStatus(state, S.exited, { detail: undefined })
        : withStatus(state, S.error)
    case INPUT_SOURCE.activity:
      return reduceActivity(state, input.kind)
    case INPUT_SOURCE.hook:
      return withExternalId(reduceHook(state, input.event), input.event.externalSessionId)
    default: {
      const never: never = input
      return never
    }
  }
}

const sameState = (a: TrackedState, b: TrackedState): boolean =>
  a.status === b.status &&
  a.turnCompleted === b.turnCompleted &&
  a.externalSessionId === b.externalSessionId &&
  a.detail === b.detail

/** Pure; returns the same reference when nothing changed. `exited` is final. */
export function reduceStatus(state: TrackedState, input: TrackerInput): TrackedState {
  if (state.status === S.exited) return state
  const next = reduceInput(state, input)
  return sameState(state, next) ? state : next
}
