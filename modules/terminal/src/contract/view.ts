import { createServiceToken } from '@pragma/sdk'
import type { ComponentType } from 'react'
import type { PtyExit } from './pty'

export interface TerminalViewProps {
  ptyId: string
  className?: string
  autoFocus?: boolean
  onExit?(exit: PtyExit): void
  onTitleChange?(title: string): void
}

/** Renderer service (§10.1.1): `ctx.services.get(TerminalViewServiceToken).TerminalView`. */
export interface TerminalViewService {
  TerminalView: ComponentType<TerminalViewProps>
}

export const TerminalViewServiceToken = createServiceToken<TerminalViewService>('terminal.view')
