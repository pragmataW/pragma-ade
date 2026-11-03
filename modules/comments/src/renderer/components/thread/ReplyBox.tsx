import { useT } from '@pragma/sdk/renderer'
import { type KeyboardEvent, useState } from 'react'
import { REPLY_ROWS } from '../../../constants'
import { COMMENTS_TESTIDS as T } from '../../../contract'
import { PrimaryButton, QuietButton, SecondaryButton } from '../../lib/buttons'

const ENTER_KEY = 'Enter'
const ESCAPE_KEY = 'Escape'

type Submit = (body: string) => Promise<unknown>

/**
 * Reply textarea, the same buttons as the editor's reply widget: Cancel · Reply and send · Reply (primary).
 * ⌘/Ctrl+Enter replies, ⌘/Ctrl+Shift+Enter replies and sends, Esc cancels; closes after a successful submit.
 */
export function ReplyBox({
  onSubmit,
  onSubmitAndSend,
  onClose,
}: {
  onSubmit: Submit
  onSubmitAndSend?: Submit
  onClose(): void
}) {
  const t = useT()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const disabled = busy || body.trim().length === 0
  const run = async (submit: Submit) => {
    if (disabled) return
    setBusy(true)
    try {
      await submit(body)
      onClose()
    } catch (e) {
      console.warn('comments: reply failed', e)
    } finally {
      setBusy(false)
    }
  }
  const keyAction = (e: KeyboardEvent<HTMLTextAreaElement>): (() => unknown) | null => {
    if (e.key === ESCAPE_KEY) return onClose
    if (e.key !== ENTER_KEY || !(e.metaKey || e.ctrlKey)) return null
    const submit = e.shiftKey ? onSubmitAndSend : onSubmit
    return submit ? () => run(submit) : null
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const action = keyAction(e)
    if (!action) return
    e.preventDefault()
    void action()
  }
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        data-testid={T.replyInput}
        aria-label={t('comments:thread.reply')}
        placeholder={t('comments:thread.replyPlaceholder')}
        // biome-ignore lint/a11y/noAutofocus: the box opens on an explicit Reply click
        autoFocus
        rows={REPLY_ROWS}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-[52px] resize-y rounded-[var(--radius-button)] border border-[var(--bd2)] bg-background px-2 py-1.5 text-[12.5px] outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap justify-end gap-1.5">
        <QuietButton data-testid={T.replyCancel} onClick={onClose}>
          {t('comments:thread.replyCancel')}
        </QuietButton>
        {onSubmitAndSend ? (
          <SecondaryButton
            data-testid={T.replySubmitAndSend}
            disabled={disabled}
            onClick={() => void run(onSubmitAndSend)}
          >
            {t('comments:thread.replyAndSend')}
          </SecondaryButton>
        ) : null}
        <PrimaryButton data-testid={T.replySubmit} disabled={disabled} onClick={() => void run(onSubmit)}>
          {t('comments:thread.replySubmit')}
        </PrimaryButton>
      </div>
    </div>
  )
}
