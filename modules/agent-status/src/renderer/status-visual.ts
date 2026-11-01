import { type AgentSessionStatus, SESSION_STATUS as S } from '@pragma/module-agents/contract'

/** Shape + colour per status (ui-notes "Status icons"); never colour alone. */
export const STATUS_VISUAL_KINDS = ['working', 'waiting', 'done', 'idle', 'error', 'starting', 'exited'] as const
export type StatusVisualKind = (typeof STATUS_VISUAL_KINDS)[number]

export interface StatusVisual {
  kind: StatusVisualKind
  colorVar: string
  labelKey: string
  spin: boolean
}

const COLOR = {
  info: 'var(--info)',
  warn: 'var(--warn)',
  ok: 'var(--ok)',
  err: 'var(--err)',
  mu: 'var(--mu)',
  fa: 'var(--fa)',
} as const
const DONE = 'done'
const label = (kind: StatusVisualKind): string => `agent-status:status.${kind}`

const VISUALS: Record<Exclude<StatusVisualKind, typeof DONE>, Omit<StatusVisual, 'kind' | 'labelKey'>> = {
  working: { colorVar: COLOR.info, spin: true },
  waiting: { colorVar: COLOR.warn, spin: false },
  idle: { colorVar: COLOR.mu, spin: false },
  error: { colorVar: COLOR.err, spin: false },
  starting: { colorVar: COLOR.mu, spin: false },
  exited: { colorVar: COLOR.fa, spin: false },
}

export function statusVisual(status: AgentSessionStatus, turnCompleted: boolean): StatusVisual {
  if (status === S.idle && turnCompleted) return { kind: DONE, colorVar: COLOR.ok, labelKey: label(DONE), spin: false }
  return { kind: status, labelKey: label(status), ...VISUALS[status] }
}
