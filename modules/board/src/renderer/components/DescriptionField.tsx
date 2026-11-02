import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Markdown } from '@pragma/ui/components/markdown'
import { useState } from 'react'
import { DESCRIPTION_ROWS, SIZE, VARIANT } from '../../constants'
import { BOARD_TESTIDS as T } from '../../contract'
import { checklistProgress } from '../../lib/checklist'
import { boardCtx } from '../lib/runtime'

/** "Checklist 1/3" next to the Description title while the description has GFM task items. */
function ChecklistCount({ markdown }: { markdown: string }) {
  const t = useT()
  const { done, total } = checklistProgress(markdown)
  if (total === 0) return null
  return (
    <span
      data-testid={T.drawerChecklist}
      className="rounded-[var(--radius-chip)] border border-[var(--bd)] px-1.5 font-mono text-[10.5px] normal-case tracking-normal"
    >
      {t('board:drawer.checklist', { done, total })}
    </span>
  )
}

/** Markdown description: Textarea (saved on blur) with an Edit/Preview toggle; preview is `@pragma/ui` Markdown. */
export function DescriptionField(props: { value: string; onSave(value: string): void }) {
  const t = useT()
  const [draft, setDraft] = useState(props.value)
  const [preview, setPreview] = useState(props.value.trim() !== '')
  const save = () => {
    if (draft !== props.value) props.onSave(draft)
  }
  const toggle = () => {
    save()
    setPreview(!preview)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] text-[var(--mu)] uppercase tracking-[0.06em]">
          {t('board:drawer.description')}
          <ChecklistCount markdown={draft} />
        </span>
        <Button data-testid={T.drawerPreviewToggle} variant={VARIANT.ghost} size={SIZE.xs} onClick={toggle}>
          {t(preview ? 'board:drawer.edit' : 'board:drawer.preview')}
        </Button>
      </div>
      {preview ? (
        <div
          data-testid={T.drawerPreview}
          className="min-h-16 rounded-[var(--radius-popover)] border border-[var(--bd)] p-2"
        >
          {draft.trim() ? (
            <Markdown source={draft} onLinkClick={(href) => void boardCtx().shell.openExternal(href)} />
          ) : (
            <span className="text-[var(--fa)]">{t('board:drawer.emptyPreview')}</span>
          )}
        </div>
      ) : (
        <textarea
          data-testid={T.drawerDescription}
          value={draft}
          rows={DESCRIPTION_ROWS}
          placeholder={t('board:drawer.descriptionPlaceholder')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          className="w-full resize-y rounded-[var(--radius-button)] border border-[var(--bd2)] bg-transparent p-2 font-mono text-[12px] text-[var(--tx)] outline-none focus:border-[var(--ac)]"
        />
      )}
    </div>
  )
}
