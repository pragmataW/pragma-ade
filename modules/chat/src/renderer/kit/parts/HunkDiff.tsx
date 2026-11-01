import { MultiFileDiff } from '@pierre/diffs/react'
import { useT } from '@pragma/sdk/renderer'
import type { CSSProperties } from 'react'
import { DIFF_STYLE_VARS, DIFF_UNIFIED, PIERRE_THEMES } from '../../../constants'
import type { FileEditHunk } from '../../../contract'
import { MAX_DIFF_CHARS } from '../../../contract'
import { useThemeMode } from './lib/useThemeMode'

export const isDiffTooLarge = (hunks: readonly FileEditHunk[]): boolean =>
  hunks.reduce((n, h) => n + h.before.length + h.after.length, 0) > MAX_DIFF_CHARS

/** One unified diff per hunk (`@pierre/diffs`, line numbers, add/del tints); a placeholder over `MAX_DIFF_CHARS`. */
export function HunkDiff({ path, hunks }: { path: string; hunks: readonly FileEditHunk[] }) {
  const t = useT()
  const themeType = useThemeMode()
  if (isDiffTooLarge(hunks)) return <div className="px-2.5 py-2 text-[12px] text-mu">{t('chat:diff.tooLarge')}</div>
  return (
    <div style={DIFF_STYLE_VARS as CSSProperties} className="flex flex-col divide-y divide-bd">
      {hunks.map((h, i) => (
        <MultiFileDiff
          // biome-ignore lint/suspicious/noArrayIndexKey: hunks are immutable per edit
          key={i}
          oldFile={{ name: path, contents: h.before }}
          newFile={{ name: path, contents: h.after }}
          options={{
            diffStyle: DIFF_UNIFIED,
            theme: PIERRE_THEMES,
            themeType,
            disableFileHeader: true,
            overflow: 'wrap',
          }}
        />
      ))}
    </div>
  )
}
