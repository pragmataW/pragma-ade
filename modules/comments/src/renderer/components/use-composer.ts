import { type KeyboardEvent, useState } from 'react'
import {
  COMPOSER_RESULT,
  type Comment,
  type CommentComposerProps,
  type ComposerResult,
  commentsIpc,
  SEND_STATUS,
} from '../../contract'
import { runtime } from '../runtime'
import { useCommentsStore } from '../store'
import { useSendFlow } from '../use-send-flow'

const ENTER_KEY = 'Enter'
const ESCAPE_KEY = 'Escape'
const failedQuietly = (e: unknown) => console.warn('comments: composer action failed', e)

/** All composer logic (the component only renders): body state, busy flag, actions and shortcuts. */
export function useComposer(p: CommentComposerProps) {
  const [body, setBody] = useState(p.initialBody ?? '')
  const [busy, setBusy] = useState(false)
  const flow = useSendFlow()
  const editing = p.editCommentId !== undefined
  const canSendNow = !editing && p.showSendNow !== false
  const disabled = busy || body.trim().length === 0

  const run = async (action: () => Promise<ComposerResult>) => {
    if (disabled) return
    setBusy(true)
    try {
      const result = await action()
      if (result.kind !== COMPOSER_RESULT.saved) setBody('')
      p.onDone?.(result)
    } catch (e) {
      failedQuietly(e)
    } finally {
      setBusy(false)
    }
  }
  const draft = (): Promise<Comment> =>
    runtime().ipc.invoke(commentsIpc.addDraft, { ...p.context, worktreeId: p.worktreeId, body })

  const addDraft = () => run(async () => ({ kind: COMPOSER_RESULT.drafted, comment: await draft() }))
  const sendNow = () =>
    run(async () => {
      const comment = await draft()
      const result = await flow.send([comment.id], { worktreeId: p.worktreeId })
      if (result?.status === SEND_STATUS.sent) return { kind: COMPOSER_RESULT.sent, comment, result }
      if (result?.status === SEND_STATUS.failed) useCommentsStore.getState().showError(result.errorKey)
      // A picker / launch suggestion (hosted next to the drawer) or the error takes over; the caller can close.
      return { kind: COMPOSER_RESULT.drafted, comment }
    })
  const save = () =>
    run(async () => {
      const id = p.editCommentId as string
      return {
        kind: COMPOSER_RESULT.saved,
        comment: await runtime().ipc.invoke(commentsIpc.update, { id, patch: { body } }),
      }
    })
  const cancel = () => p.onDone?.({ kind: COMPOSER_RESULT.cancelled })

  /** ⌘/Ctrl+Enter → add (save when editing), ⌘/Ctrl+Shift+Enter → send now, Esc → cancel. */
  const shortcutAction = (e: KeyboardEvent): (() => unknown) | undefined => {
    if (e.key === ESCAPE_KEY) return cancel
    if (e.key !== ENTER_KEY || !(e.metaKey || e.ctrlKey)) return undefined
    if (editing) return save
    if (!e.shiftKey) return addDraft
    return canSendNow ? sendNow : undefined
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const action = shortcutAction(e)
    if (!action) return
    e.preventDefault()
    void action()
  }

  return { body, setBody, disabled, editing, canSendNow, addDraft, sendNow, save, cancel, onKeyDown }
}
