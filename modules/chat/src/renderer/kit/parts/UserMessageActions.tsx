import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { GitFork, History } from '@pragma/ui/icons'
import type { ComponentType } from 'react'
import { ICON_PX, ICON_STROKE, SIZE_ICON_XS, VARIANT_GHOST } from '../../../constants'
import { CHAT_TESTIDS, type ChatPartProps, hasAction, type MessageItem, SESSION_ACTION } from '../../../contract'
import { useChatHost } from '../../host-adapter'
import { UserMessage } from './UserMessage'

/** The provider's wording: what a rewind restores differs per agent (files only, or files and conversation). */
export interface UserMessageActionsCopy {
  rewind?: { labelKey: string; titleKey: string; messageKey: string; confirmKey: string }
  fork?: { labelKey: string }
}

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>

function HoverAction({
  testId,
  labelKey,
  icon: I,
  onClick,
}: {
  testId: string
  labelKey: string
  icon: Icon
  onClick(): void
}) {
  const t = useT()
  return (
    <Button
      variant={VARIANT_GHOST}
      size={SIZE_ICON_XS}
      data-testid={testId}
      aria-label={t(labelKey)}
      title={t(labelKey)}
      onClick={onClick}
      className="size-6 text-mu hover:text-tx"
    >
      <I size={ICON_PX} strokeWidth={ICON_STROKE} />
    </Button>
  )
}

type RewindCopy = NonNullable<UserMessageActionsCopy['rewind']>
type ForkCopy = NonNullable<UserMessageActionsCopy['fork']>

/** The copy of an action the idle session offers (undefined hides its button). */
function offered<C>(copy: C | undefined, offers: boolean, turnActive: boolean): C | undefined {
  return copy && offers && !turnActive ? copy : undefined
}

function MessageActions({
  item,
  session,
  rewind,
  fork,
}: ChatPartProps<MessageItem> & { rewind?: RewindCopy; fork?: ForkCopy }) {
  const host = useChatHost()
  const onRewind = async (c: RewindCopy) => {
    const ok = await host.confirm({
      titleKey: c.titleKey,
      messageKey: c.messageKey,
      confirmKey: c.confirmKey,
      destructive: true,
    })
    if (ok) await session.action({ action: SESSION_ACTION.rewind, messageId: item.id })
  }
  return (
    <div className="flex gap-0.5 opacity-0 transition-opacity group-focus-within/msg:opacity-100 group-hover/msg:opacity-100">
      {rewind ? (
        <HoverAction
          testId={CHAT_TESTIDS.messageRewind}
          labelKey={rewind.labelKey}
          icon={History}
          onClick={() => void onRewind(rewind)}
        />
      ) : null}
      {fork ? (
        <HoverAction
          testId={CHAT_TESTIDS.messageFork}
          labelKey={fork.labelKey}
          icon={GitFork}
          onClick={() => void session.action({ action: SESSION_ACTION.fork, messageId: item.id })}
        />
      ) : null}
    </div>
  )
}

/** The user message bubble plus the hover actions the idle session offers. */
function UserMessageWithActions({
  item,
  session,
  copy,
}: ChatPartProps<MessageItem> & { copy: UserMessageActionsCopy }) {
  const { info, turnActive } = session.transcript
  const rewind = offered(copy.rewind, hasAction(info, SESSION_ACTION.rewind), turnActive)
  const fork = offered(copy.fork, hasAction(info, SESSION_ACTION.fork), turnActive)
  return (
    <div className="group/msg flex flex-col items-end gap-0.5">
      <UserMessage item={item} session={session} />
      {rewind || fork ? <MessageActions item={item} session={session} rewind={rewind} fork={fork} /> : null}
    </div>
  )
}

/**
 * The kit's user message with hover actions: rewind (after a confirmation in the provider's words) and fork. Each
 * shows only while the turn is idle, the session offers the action and the provider gave its copy.
 */
export function createUserMessage(copy: UserMessageActionsCopy) {
  // biome-ignore lint/correctness/noComponentHookFactories: the kit's documented factory (§5.4); called once at module scope per provider definition
  const Part = (props: ChatPartProps<MessageItem>) => <UserMessageWithActions {...props} copy={copy} />
  Part.displayName = 'UserMessageWithActions'
  return Part
}
