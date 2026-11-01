import { CommentsUiServiceToken } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { AnchoredPopover } from '@pragma/ui/components/anchored-popover'
import { type ReactNode, useMemo, useState } from 'react'
import { POPOVER_WIDTH } from '../constants'
import { BrowserIpc, type BrowserPick, type Rect, BROWSER_TEST_IDS as T } from '../contract'
import { toElementContext } from './lib/element-context'
import { send } from './lib/ipc'
import { pickRectInWindow } from './lib/pick-rect'
import { runtime } from './runtime'

const GUARD_MODE = 'snapshot'

/** Closes the popover: unfreezes the page in main and forgets the pick. */
export function dismissPick(pick: BrowserPick): void {
  runtime().store.getState().clearPick()
  void send(BrowserIpc.pickDismiss, { pickId: pick.pickId })
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 gap-2 text-[11.5px]">
      <span className="w-[72px] shrink-0 text-[var(--fa)]">{label}</span>
      <span className="min-w-0 break-all font-mono text-[var(--mu)]">{children}</span>
    </div>
  )
}

function Toggle(p: {
  testId: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange(v: boolean): void
}) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] has-[:disabled]:opacity-50">
      <input
        type="checkbox"
        data-testid={p.testId}
        checked={p.checked}
        disabled={p.disabled}
        onChange={(e) => p.onChange(e.target.checked)}
        className="size-3.5 accent-[var(--ac)]"
      />
      {p.label}
    </label>
  )
}

/** The element comment popover at the picked element (page frozen behind it); 05's composer does the rest. */
export function PickPopover({ pick, area }: { pick: BrowserPick; area: Rect }) {
  const t = useT()
  const ui = runtime().ctx.services.tryGet(CommentsUiServiceToken)
  const errorCount = pick.consoleErrors.length
  const [shot, setShot] = useState(true)
  const [consoleOn, setConsole] = useState(errorCount > 0)
  const rect = useMemo(() => pickRectInWindow(pick.rect, pick.viewport, area), [pick, area])
  const context = useMemo(
    () => toElementContext(pick, { includeScreenshotAndStyles: shot, includeConsoleErrors: consoleOn }),
    [pick, shot, consoleOn],
  )
  if (!ui) return null
  const close = () => dismissPick(pick)
  const component = pick.component
  return (
    <AnchoredPopover rect={rect} open onOpenChange={(open) => !open && close()} guardMode={GUARD_MODE}>
      <div data-testid={T.pickPopover} style={{ width: POPOVER_WIDTH }} className="flex flex-col gap-2">
        <div className="text-[13px] font-semibold">{t('browser:pick.title')}</div>
        <div className="break-all font-mono text-[12px] text-[var(--act)]">{pick.selector}</div>
        <Row label={t('browser:pick.domPath')}>{pick.domPath}</Row>
        {component ? <Row label={t('browser:pick.component')}>{component.name}</Row> : null}
        {component?.source ? <Row label={t('browser:pick.source')}>{component.source}</Row> : null}
        <Toggle
          testId={T.pickAttachShot}
          label={t('browser:pick.attachShotAndStyles')}
          checked={shot}
          onChange={setShot}
        />
        <Toggle
          testId={T.pickIncludeConsole}
          label={t('browser:pick.includeConsole', { count: errorCount })}
          checked={consoleOn}
          disabled={errorCount === 0}
          onChange={setConsole}
        />
        <ui.CommentComposer
          worktreeId={pick.worktreeId}
          context={{ source: 'browser', element: context }}
          onDone={close}
        />
      </div>
    </AnchoredPopover>
  )
}
