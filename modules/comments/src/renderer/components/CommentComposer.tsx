import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { type CommentComposerProps, COMMENTS_TESTIDS as T } from '../../contract'
import { PrimaryButton, QuietButton, SecondaryButton } from '../lib/buttons'
import { useComposer } from './use-composer'

const TEXTAREA_CLASS =
  'min-h-[72px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'

/** Textarea + "Add to drafts" / "Send now" (create) or "Save" / "Cancel" (edit); 07 and 08 reuse it. */
export function CommentComposer(props: CommentComposerProps) {
  const t = useT()
  const c = useComposer(props)
  return (
    <div data-testid={T.composer} className={cn('flex flex-col gap-2', props.className)}>
      <textarea
        data-testid={T.composerInput}
        aria-label={t('comments:composer.label')}
        className={TEXTAREA_CLASS}
        placeholder={t('comments:composer.placeholder')}
        // biome-ignore lint/a11y/noAutofocus: the composer opens on an explicit user action (comment button)
        autoFocus={props.autoFocus !== false}
        value={c.body}
        onChange={(e) => c.setBody(e.target.value)}
        onKeyDown={c.onKeyDown}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{c.editing ? null : t('comments:composer.hint')}</span>
        <div className="flex gap-2">
          {c.editing ? (
            <>
              <QuietButton data-testid={T.composerCancel} onClick={c.cancel}>
                {t('comments:composer.cancel')}
              </QuietButton>
              <PrimaryButton data-testid={T.composerSave} disabled={c.disabled} onClick={() => void c.save()}>
                {t('comments:composer.save')}
              </PrimaryButton>
            </>
          ) : (
            <>
              <SecondaryButton data-testid={T.composerAddDraft} disabled={c.disabled} onClick={() => void c.addDraft()}>
                {t('comments:composer.addDraft')}
              </SecondaryButton>
              {c.canSendNow ? (
                <PrimaryButton data-testid={T.composerSendNow} disabled={c.disabled} onClick={() => void c.sendNow()}>
                  {t('comments:composer.sendNow')}
                </PrimaryButton>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
