import type { AgentSessionStatus } from '@pragma/module-agents/contract'
import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import type { ReactNode } from 'react'
import { AGENT_STATUS_DATA_ATTRS as A, AGENT_STATUS_TEST_IDS as T } from '../contract'
import { type StatusVisualKind, statusVisual } from './status-visual'

export interface StatusIconProps {
  status: AgentSessionStatus
  turnCompleted: boolean
  size?: keyof typeof ICON_SIZE
  className?: string
}

/** 12×12 viewBox geometry (ui-notes: 11px ring, 8px dot with halo). */
const G = {
  box: 12,
  c: 6,
  ring: 4.5,
  dot: 3,
  halo: 5,
  hollow: 3.25,
  stroke: 1.5,
  gap: '21 7',
  haloOpacity: 0.3,
  paint: 'currentColor',
  none: 'none',
} as const
export const ICON_SIZE = { sm: 'sm', md: 'md' } as const
const SIZE_PX = { [ICON_SIZE.sm]: 10, [ICON_SIZE.md]: 12 } as const
const CHECK_PATH = 'M2.5 6.25 4.75 8.5 9.5 3.5'

const ring = (
  <circle
    cx={G.c}
    cy={G.c}
    r={G.ring}
    fill={G.none}
    stroke={G.paint}
    strokeWidth={G.stroke}
    strokeDasharray={G.gap}
    strokeLinecap="round"
    transform={`rotate(-60 ${G.c} ${G.c})`}
  />
)
const dot = <circle cx={G.c} cy={G.c} r={G.dot} fill={G.paint} />
const hollow = <circle cx={G.c} cy={G.c} r={G.hollow} fill={G.none} stroke={G.paint} strokeWidth={G.stroke} />

const SHAPES: Record<StatusVisualKind, ReactNode> = {
  working: ring,
  starting: ring,
  waiting: (
    <>
      <circle cx={G.c} cy={G.c} r={G.halo} fill={G.paint} opacity={G.haloOpacity} />
      {dot}
    </>
  ),
  done: (
    <path
      d={CHECK_PATH}
      fill={G.none}
      stroke={G.paint}
      strokeWidth={G.stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  idle: hollow,
  error: dot,
  exited: hollow,
}

/** The status icon (shared: 09 board cards, 11a chat). */
export function StatusIcon({ status, turnCompleted, size = ICON_SIZE.md, className }: StatusIconProps) {
  const t = useT()
  const v = statusVisual(status, turnCompleted)
  const px = SIZE_PX[size]
  return (
    <svg
      role="img"
      aria-label={t(v.labelKey)}
      data-testid={T.icon}
      {...{ [A.status]: status, [A.visual]: v.kind }}
      width={px}
      height={px}
      viewBox={`0 0 ${G.box} ${G.box}`}
      className={cn('shrink-0', v.spin && 'animate-spin motion-reduce:animate-none', className)}
      style={{ color: v.colorVar }}
    >
      {SHAPES[v.kind]}
    </svg>
  )
}
