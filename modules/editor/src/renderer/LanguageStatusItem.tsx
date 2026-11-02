import { useT } from '@pragma/sdk/renderer'
import { useEffect, useState } from 'react'
import {
  EDITOR_STATE,
  EditorIpc,
  EditorIpcEvents,
  type EditorLanguageStatus,
  type EditorStatus,
  LANGUAGE_STATE,
  EDITOR_TEST_IDS as T,
} from '../contract'
import { useActiveWorktree, useEditorStatus } from './hooks'
import { editorRuntime } from './runtime'

/** The active worktree's language status (`editor.getLanguageStatus` + `editor.languageStatusChanged`). */
function useLanguageStatus(worktreeId: string | undefined): EditorLanguageStatus | null {
  const { ipc } = editorRuntime().ctx
  const [status, setStatus] = useState<EditorLanguageStatus | null>(null)
  useEffect(() => {
    setStatus(null)
    if (!worktreeId) return
    let live = true
    const sub = ipc.subscribe(EditorIpcEvents.languageStatusChanged, (e) => {
      if (live && e.worktreeId === worktreeId) setStatus(e.status)
    })
    void ipc.invoke(EditorIpc.getLanguageStatus, { worktreeId }).then((s) => live && setStatus(s))
    return () => {
      live = false
      sub.dispose()
    }
  }, [ipc, worktreeId])
  return status
}

const CLASS = 'px-1.5 font-mono text-[11.5px] text-[var(--mu)]'
type BusyState = Exclude<EditorStatus['state'], 'ready' | 'not-installed'>
const SHORT_KEYS: Record<BusyState, string> = {
  downloading: 'editor:status.short.downloading',
  verifying: 'editor:status.short.verifying',
  extracting: 'editor:status.short.extracting',
  starting: 'editor:status.short.starting',
  error: 'editor:status.short.error',
}

/** `statusbar.right`: "LSP state" of the active worktree's workbench (ui-notes). */
export function LanguageStatusItem() {
  const t = useT()
  const worktree = useActiveWorktree()
  const server = useEditorStatus()
  const status = useLanguageStatus(worktree?.id)
  if (!worktree || !server || server.state === EDITOR_STATE.notInstalled) return null
  if (server.state !== EDITOR_STATE.ready)
    return (
      <span data-testid={T.lspStatus} className={CLASS}>
        {t(SHORT_KEYS[server.state])}
      </span>
    )
  if (!status || status.state === LANGUAGE_STATE.idle || !status.languageId) return null
  const language = status.languageId
  return (
    <span data-testid={T.lspStatus} className={CLASS}>
      {status.state === LANGUAGE_STATE.ok
        ? t('editor:lsp.ok', { language })
        : t('editor:lsp.problems', {
            language,
            errors: t('editor:lsp.errors', { count: status.errors }),
            warnings: t('editor:lsp.warnings', { count: status.warnings }),
          })}
    </span>
  )
}
