import { type RightTabProps, useT } from '@pragma/sdk/renderer'
import { EmptyState } from '@pragma/ui'
import { useEffect, useRef } from 'react'
import { RENDERER_ICONS } from '../constants'
import { EditorIpc, EDITOR_TEST_IDS as T } from '../contract'
import { useActiveWorktree, useEditorStatus } from './hooks'
import { editorRuntime } from './runtime'
import { StatusPanel } from './StatusPanel'

const call = (c: (typeof EditorIpc)[keyof typeof EditorIpc]) =>
  void editorRuntime()
    .ctx.ipc.invoke(c as typeof EditorIpc.ensureReady, {})
    .catch((error: unknown) => console.warn(`editor: ${c.channel} failed`, error))

/**
 * The Files tab: status UI until the server is ready; then the native workbench view covers this area.
 * The dock keeps it mounted from launch, so install + server start wait for its first showing (user decision
 * 2026-11-02): no VSCodium download or `codium-server` unless the Files tab is opened.
 */
export function FilesTab({ visible }: Pick<RightTabProps, 'visible'>) {
  const t = useT()
  const status = useEditorStatus()
  const worktree = useActiveWorktree()
  const started = useRef(false)
  useEffect(() => {
    if (!visible || started.current) return
    started.current = true
    call(EditorIpc.ensureReady)
  }, [visible])
  return (
    <div data-testid={T.filesTab} className="relative h-full w-full bg-[var(--bg)]">
      {worktree ? null : (
        <EmptyState
          testId={T.status}
          icon={RENDERER_ICONS.noWorktree}
          title={t('editor:status.noWorktreeTitle')}
          description={t('editor:status.noWorktree')}
        />
      )}
      {worktree && status ? (
        <StatusPanel
          status={status}
          onDownload={() => call(EditorIpc.retry)}
          onCancel={() => call(EditorIpc.cancelDownload)}
          onRetry={() => call(EditorIpc.retry)}
          onRedownload={() => call(EditorIpc.reinstall)}
        />
      ) : null}
    </div>
  )
}
