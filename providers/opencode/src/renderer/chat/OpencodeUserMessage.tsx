import { hasAction, type MessageItem, SESSION_ACTION } from '@pragma/module-chat/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { GitFork, History } from '@pragma/ui/icons'
import type { ComponentType } from 'react'
import {
  ICON_PX,
  ICON_STROKE,
  OPENCODE_CHAT_TESTIDS,
  SIZE_ICON_XS,
  USER_MESSAGE_I18N,
  VARIANT_GHOST,
} from './constants'
import { type ChatPartProps, UserMessage, useChatHost } from './kit'

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

/**
 * The kit's user message with hover actions: rewind (files and conversation back to before it, after a confirmation)
 * and fork (continue in a copy from before it). Each shows only while the turn is idle and the session offers it.
 */
export function OpencodeUserMessage({ item, session }: ChatPartProps<MessageItem>) {
  const host = useChatHost()
  const { info, turnActive } = session.transcript
  const rewind = hasAction(info, SESSION_ACTION.rewind) && !turnActive
  const fork = hasAction(info, SESSION_ACTION.fork) && !turnActive
  const onRewind = async () => {
    const ok = await host.confirm({
      titleKey: USER_MESSAGE_I18N.rewindTitle,
      messageKey: USER_MESSAGE_I18N.rewindMessage,
      confirmKey: USER_MESSAGE_I18N.rewindConfirm,
      destructive: true,
    })
    if (ok) await session.action({ action: SESSION_ACTION.rewind, messageId: item.id })
  }
  return (
    <div className="group/msg flex flex-col items-end gap-0.5">
      <UserMessage item={item} session={session} />
      {rewind || fork ? (
        <div className="flex gap-0.5 opacity-0 transition-opacity group-focus-within/msg:opacity-100 group-hover/msg:opacity-100">
          {rewind ? (
            <HoverAction
              testId={OPENCODE_CHAT_TESTIDS.rewind}
              labelKey={USER_MESSAGE_I18N.rewind}
              icon={History}
              onClick={() => void onRewind()}
            />
          ) : null}
          {fork ? (
            <HoverAction
              testId={OPENCODE_CHAT_TESTIDS.fork}
              labelKey={USER_MESSAGE_I18N.fork}
              icon={GitFork}
              onClick={() => void session.action({ action: SESSION_ACTION.fork, messageId: item.id })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
