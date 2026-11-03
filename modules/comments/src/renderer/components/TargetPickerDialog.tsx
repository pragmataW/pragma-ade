import { useT } from '@pragma/sdk/renderer'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@pragma/ui/components/dialog'
import { Label } from '@pragma/ui/components/label'
import { RadioGroup, RadioGroupItem } from '@pragma/ui/components/radio-group'
import { useState } from 'react'
import { COMMENTS_TESTIDS as T } from '../../contract'
import { PrimaryButton, QuietButton } from '../lib/buttons'
import { SEND, useBusy } from '../lib/use-busy'
import { type CommentsState, useCommentsStore } from '../store'
import { useSendFlow } from '../use-send-flow'

type Picker = NonNullable<CommentsState['targetPicker']>
const close = () => useCommentsStore.getState().closeTargetPicker()

function PickerBody({ picker }: { picker: Picker }) {
  const t = useT()
  const flow = useSendFlow()
  const [chosen, setChosen] = useState(picker.defaultSessionId)
  const [busy, run] = useBusy(SEND)
  const send = () => run(() => flow.sendTo(picker.worktreeId, chosen))
  return (
    <>
      <DialogTitle>{t('comments:target.title')}</DialogTitle>
      <DialogDescription>{t('comments:target.description', { count: picker.sessions.length })}</DialogDescription>
      <RadioGroup value={chosen} onValueChange={setChosen} className="gap-1">
        {picker.sessions.map((s) => (
          <Label
            key={s.id}
            data-testid={T.targetOption}
            data-session-id={s.id}
            className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-[13px]"
          >
            <RadioGroupItem value={s.id} />
            <span className="flex-1 truncate">{s.title}</span>
          </Label>
        ))}
      </RadioGroup>
      <DialogFooter>
        <QuietButton onClick={close}>{t('comments:target.cancel')}</QuietButton>
        <PrimaryButton data-testid={T.targetSend} disabled={busy} onClick={() => void send()}>
          {t('comments:target.send')}
        </PrimaryButton>
      </DialogFooter>
    </>
  )
}

/** "Send to which agent?" when the worktree has several running sessions; the default is preselected. */
export function TargetPickerDialog() {
  const picker = useCommentsStore((s) => s.targetPicker)
  return (
    <Dialog open={picker !== null} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent data-testid={T.targetPicker} className="max-w-[420px]">
        {picker ? <PickerBody key={picker.worktreeId} picker={picker} /> : null}
      </DialogContent>
    </Dialog>
  )
}
