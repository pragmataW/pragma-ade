import { useT } from '@pragma/sdk/renderer'
import { Icon } from '@pragma/ui/components/icon'
import type { ReactNode } from 'react'
import {
  BYTES_PER_MB,
  MB_FRACTION_DIGITS,
  PERCENT,
  REDOWNLOAD_ERROR_KEYS,
  RENDERER_ICONS,
  STATUS_ICON_PX,
} from '../constants'
import { EDITOR_STATE, type EditorStatus, EDITOR_TEST_IDS as T } from '../contract'
import { ActionButton } from './ActionButton'

export interface StatusPanelProps {
  status: EditorStatus
  onDownload(): void
  onCancel(): void
  onRetry(): void
  onRedownload(): void
}

const MB = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: MB_FRACTION_DIGITS,
  style: 'unit',
  unit: 'megabyte',
})
const mb = (bytes: number): string => MB.format(bytes / BYTES_PER_MB)

function Shell({ children, icon }: { children: ReactNode; icon?: string }) {
  return (
    <div
      data-testid={T.status}
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-[13px] text-[var(--mu)]"
    >
      {icon ? <Icon name={icon} size={STATUS_ICON_PX} className="animate-spin text-[var(--fa)]" /> : null}
      {children}
    </div>
  )
}

function Progress({ received, total }: { received: number; total: number }) {
  const percent = total > 0 ? Math.min(PERCENT, Math.round((received / total) * PERCENT)) : 0
  return (
    <div
      role="progressbar"
      data-testid={T.progress}
      aria-valuemin={0}
      aria-valuemax={PERCENT}
      aria-valuenow={percent}
      className="h-1.5 w-56 overflow-hidden rounded-full bg-[var(--el)]"
    >
      <div className="h-full bg-[var(--ac)] transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  )
}

/** Install/server status of the Files tab (pure; one exhaustive switch). */
export function StatusPanel({ status, onDownload, onCancel, onRetry, onRedownload }: StatusPanelProps) {
  const t = useT()
  switch (status.state) {
    case EDITOR_STATE.notInstalled:
      return (
        <Shell>
          <span>{t('editor:status.notInstalled', { size: mb(status.sizeBytes) })}</span>
          <ActionButton testId={T.download} onClick={onDownload}>
            {t('editor:status.download')}
          </ActionButton>
        </Shell>
      )
    case EDITOR_STATE.downloading:
      return (
        <Shell>
          <span>{t('editor:status.downloading', { received: mb(status.received), total: mb(status.total) })}</span>
          <Progress received={status.received} total={status.total} />
          <ActionButton testId={T.cancel} secondary onClick={onCancel}>
            {t('editor:status.cancel')}
          </ActionButton>
        </Shell>
      )
    case EDITOR_STATE.verifying:
      return <Shell icon={RENDERER_ICONS.spinner}>{t('editor:status.verifying')}</Shell>
    case EDITOR_STATE.extracting:
      return <Shell icon={RENDERER_ICONS.spinner}>{t('editor:status.extracting')}</Shell>
    case EDITOR_STATE.starting:
      return <Shell icon={RENDERER_ICONS.spinner}>{t('editor:status.starting')}</Shell>
    case EDITOR_STATE.ready:
      return null
    case EDITOR_STATE.error:
      return (
        <Shell>
          <span className="text-[var(--err)]">{t(status.errorKey)}</span>
          <div className="flex gap-2">
            {status.retryable ? (
              <ActionButton testId={T.retry} onClick={onRetry}>
                {t('editor:status.retry')}
              </ActionButton>
            ) : null}
            {(REDOWNLOAD_ERROR_KEYS as readonly string[]).includes(status.errorKey) ? (
              <ActionButton testId={T.redownload} secondary onClick={onRedownload}>
                {t('editor:status.redownload')}
              </ActionButton>
            ) : null}
          </div>
        </Shell>
      )
    default: {
      const never: never = status
      return never
    }
  }
}
