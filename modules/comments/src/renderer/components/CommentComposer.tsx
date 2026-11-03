import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { COMPOSER_SURFACE, type CommentComposerProps, COMMENTS_TESTIDS as T } from '../../contract'
import { PrimaryButton, QuietButton, SecondaryButton } from '../lib/buttons'
import { useComposer } from './use-composer'

/** ui-notes: inputs = 6px radius, strong border (`bd2`), app ground (`bg`) so they read as fields on the card. */
const TEXTAREA_CLASS =
  'min-h-[72px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
/** ui-notes: the composer is its own box (card `el`, 1px `bd`, 10px radius) with a subtle lift over the diff/page. */
const CARD_CLASS = 'rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm'

/**
 * Textarea + Cancel / "Add to drafts" / "Send now" (create) or Cancel / "Save" (edit); 07 and 08 reuse it. Cancel
 * and Esc (anywhere in the composer) report `cancelled` through `onDone`, so a host can always close it.
 */
export function CommentComposer(props: CommentComposerProps) {
  const t = useT()
  const c = useComposer(props)
  const card = props.surface !== COMPOSER_SURFACE.plain
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Esc from any focused control inside closes the composer
    <div
      data-testid={T.composer}
      className={cn('flex flex-col gap-2', card && CARD_CLASS, props.className)}
      onKeyDown={c.onKeyDown}
    >
      <textarea
        data-testid={T.composerInput}
        aria-label={t('comments:composer.label')}
        className={TEXTAREA_CLASS}
        placeholder={t('comments:composer.placeholder')}
        // biome-ignore lint/a11y/noAutofocus: the composer opens on an explicit user action (comment button)
        autoFocus={props.autoFocus !== false}
        value={c.body}
        onChange={(e) => c.setBody(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{c.editing ? null : t('comments:composer.hint')}</span>
        <div className="ml-auto flex gap-2">
          <QuietButton data-testid={T.composerCancel} title={t('comments:composer.cancelHint')} onClick={c.cancel}>
            {t('comments:composer.cancel')}
          </QuietButton>
          {c.editing ? (
            <PrimaryButton data-testid={T.composerSave} disabled={c.disabled} onClick={() => void c.save()}>
              {t('comments:composer.save')}
            </PrimaryButton>
          ) : (
            <>
              {c.canSendNow ? (
                <SecondaryButton data-testid={T.composerSendNow} disabled={c.disabled} onClick={() => void c.sendNow()}>
                  {t('comments:composer.sendNow')}
                </SecondaryButton>
              ) : null}
              <PrimaryButton data-testid={T.composerAddDraft} disabled={c.disabled} onClick={() => void c.addDraft()}>
                {t('comments:composer.addDraft')}
              </PrimaryButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
