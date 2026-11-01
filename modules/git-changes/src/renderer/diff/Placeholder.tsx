import { useT } from '@pragma/sdk/renderer'
import { FileWarning } from '@pragma/ui/icons'
import { DIFF_ICON_PX } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import { formatBytes } from '../lib/format'
import type { PlaceholderInfo, PlaceholderKind } from './diff-options'

const TEXT_KEYS = {
  binary: 'git-changes:diff.placeholder.binary',
  tooLarge: 'git-changes:diff.placeholder.tooLarge',
  unreadable: 'git-changes:diff.placeholder.unreadable',
} as const satisfies Record<PlaceholderKind, string>

/** Shown instead of a diff for binary, too large or unreadable files. */
export function Placeholder({ info, limitBytes }: { info: PlaceholderInfo; limitBytes: number }) {
  const t = useT()
  const params = { size: formatBytes(info.bytes ?? 0), limit: formatBytes(limitBytes) }
  return (
    <div
      data-testid={T.placeholder}
      data-kind={info.kind}
      className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-muted-foreground text-sm"
    >
      <FileWarning size={DIFF_ICON_PX} aria-hidden />
      {t(TEXT_KEYS[info.kind], params)}
    </div>
  )
}
