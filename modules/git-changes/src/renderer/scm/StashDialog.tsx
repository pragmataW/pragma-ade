import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@pragma/ui/components/dialog'
import { Input } from '@pragma/ui/components/input'
import { RadioGroup, RadioGroupItem } from '@pragma/ui/components/radio-group'
import { type FormEvent, useState } from 'react'
import { BUTTON_TYPE, VARIANT_GHOST } from '../../constants'
import { type ChangedFile, FILE_STATUS, GitChangesTestIds as T } from '../../contract'
import { type ScmActions, STASH_KINDS, type StashKind } from './actions'

const [TRACKED, UNTRACKED, STAGED] = STASH_KINDS

const distinct = (files: readonly ChangedFile[]): number => new Set(files.map((f) => f.path)).size

/** How many files each kind of stash would take (a file listed as staged and unstaged counts once). */
export function stashCounts(files: readonly ChangedFile[]): Record<StashKind, number> {
  return {
    [TRACKED]: distinct(files.filter((f) => f.status !== FILE_STATUS.U)),
    [UNTRACKED]: distinct(files),
    [STAGED]: distinct(files.filter((f) => f.staged)),
  }
}

/**
 * One place to stash: what to take (tracked / with untracked / staged only, each with its file count) and an
 * optional message, apart from the commit message box.
 */
export function StashDialog(props: {
  initialKind: StashKind
  files: readonly ChangedFile[]
  actions: ScmActions
  onClose(): void
}) {
  const t = useT()
  const counts = stashCounts(props.files)
  const [kind, setKind] = useState<StashKind>(props.initialKind)
  const [message, setMessage] = useState('')
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (counts[kind] === 0) return
    props.onClose()
    void props.actions.stashPush(kind, message.trim())
  }
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent data-testid={T.stashDialog} className="max-w-[420px]">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <DialogTitle>{t('git-changes:scm.stash.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('git-changes:scm.stash.dialogHint')}</DialogDescription>
          </div>
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as StashKind)} className="gap-2">
            {STASH_KINDS.map((k) => (
              <label
                key={k}
                htmlFor={`gc-stash-kind-${k}`}
                className="flex cursor-pointer items-center gap-2 text-[13px] has-[button:disabled]:cursor-default has-[button:disabled]:opacity-50"
              >
                <RadioGroupItem
                  id={`gc-stash-kind-${k}`}
                  value={k}
                  data-testid={T.stashKind(k)}
                  disabled={counts[k] === 0}
                />
                <span className="flex-1">{t(`git-changes:scm.stash.kind.${k}`)}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {t('git-changes:scm.stash.fileCount', { count: counts[k] })}
                </span>
              </label>
            ))}
          </RadioGroup>
          <Input
            autoFocus
            data-testid={T.stashPrompt}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('git-changes:scm.stash.messagePlaceholder')}
            aria-label={t('git-changes:scm.stash.messagePlaceholder')}
          />
          <DialogFooter>
            <Button type={BUTTON_TYPE} variant={VARIANT_GHOST} onClick={props.onClose}>
              {t('git-changes:scm.stash.cancel')}
            </Button>
            <Button type="submit" data-testid={T.stashSubmit} disabled={counts[kind] === 0}>
              {t('git-changes:scm.stash.submit', { count: counts[kind] })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
