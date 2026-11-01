import { PTY_EXIT_REASON, PTY_STATUS, type PtyExit, type PtyInfo } from '../../contract'

export const VIEW_STATE = {
  attaching: 'attaching',
  live: 'live',
  exited: 'exited',
  notFound: 'not-found',
  error: 'error',
} as const
export const VIEW_STATE_KINDS = [
  VIEW_STATE.attaching,
  VIEW_STATE.live,
  VIEW_STATE.exited,
  VIEW_STATE.notFound,
  VIEW_STATE.error,
] as const
export type ViewStateKind = (typeof VIEW_STATE_KINDS)[number]

export type ViewExit = Omit<PtyExit, 'ptyId'>
export type ViewState =
  | { kind: typeof VIEW_STATE.attaching }
  | { kind: typeof VIEW_STATE.live; info: PtyInfo }
  | { kind: typeof VIEW_STATE.exited; exit: ViewExit }
  | { kind: typeof VIEW_STATE.notFound }
  | { kind: typeof VIEW_STATE.error; message: string }

export const VIEW_ACTION = { attached: 'attached', notFound: 'notFound', exit: 'exit', failed: 'failed' } as const
export type ViewAction =
  | { type: typeof VIEW_ACTION.attached; info: PtyInfo; exit?: ViewExit | null }
  | { type: typeof VIEW_ACTION.notFound }
  | { type: typeof VIEW_ACTION.exit; exit: ViewExit }
  | { type: typeof VIEW_ACTION.failed; message: string }

export const INITIAL_VIEW_STATE: ViewState = { kind: VIEW_STATE.attaching }

const exitOf = (info: PtyInfo): ViewExit => ({
  exitCode: info.exitCode,
  signal: info.signal,
  reason: PTY_EXIT_REASON.exited,
})

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case VIEW_ACTION.attached:
      if (action.info.status === PTY_STATUS.exited)
        return { kind: VIEW_STATE.exited, exit: action.exit ?? exitOf(action.info) }
      return { kind: VIEW_STATE.live, info: action.info }
    case VIEW_ACTION.notFound:
      return { kind: VIEW_STATE.notFound }
    case VIEW_ACTION.exit:
      return state.kind === VIEW_STATE.notFound ? state : { kind: VIEW_STATE.exited, exit: action.exit }
    case VIEW_ACTION.failed:
      return { kind: VIEW_STATE.error, message: action.message }
    default: {
      const never: never = action
      return never
    }
  }
}
