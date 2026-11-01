import { type EditorLanguageStatus, LANGUAGE_STATE } from '@pragma/module-editor/contract'
import type { BridgeConnection } from './bridgeConnection'
import { LANGUAGE_STATUS_DEBOUNCE_MS, SEVERITY, type Severity } from './constants'
import type { Disposable, VscodeApi } from './vscodeApi'

/** The status bar's "LSP state": no editor → idle, no errors/warnings → ok, else problems with counts. */
export function computeLanguageStatus(
  activeDoc: { languageId: string } | undefined,
  diags: { severity: Severity }[],
): EditorLanguageStatus {
  if (!activeDoc) return { languageId: null, state: LANGUAGE_STATE.idle, errors: 0, warnings: 0 }
  const errors = diags.filter((d) => d.severity === SEVERITY.error).length
  const warnings = diags.filter((d) => d.severity === SEVERITY.warning).length
  const state = errors + warnings === 0 ? LANGUAGE_STATE.ok : LANGUAGE_STATE.problems
  return { languageId: activeDoc.languageId, state, errors, warnings }
}

/** Reports the active editor's status (debounced, deduped) through `editor.languageStatus`. */
export function startLanguageStatusReporter(
  api: VscodeApi,
  conn: Pick<BridgeConnection, 'request'>,
  debounceMs = LANGUAGE_STATUS_DEBOUNCE_MS,
): Disposable {
  let last = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const report = (): void => {
    const doc = api.activeDocument()
    const status = computeLanguageStatus(doc, doc ? api.diagnostics(doc.path) : [])
    const key = JSON.stringify(status)
    if (key === last) return
    last = key
    void conn.request('languageStatus', status).catch(() => {
      last = ''
    })
  }
  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(report, debounceMs)
  }
  const subs = [api.onDidChangeActiveEditor(schedule), api.onDidChangeDiagnostics(schedule)]
  schedule()
  return {
    dispose: () => {
      if (timer) clearTimeout(timer)
      for (const s of subs) s.dispose()
    },
  }
}
