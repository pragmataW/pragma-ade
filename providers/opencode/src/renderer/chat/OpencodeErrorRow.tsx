import { ERROR_CODE, type ErrorItem } from '@pragma/module-chat/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { KeyRound } from '@pragma/ui/icons'
import {
  ERROR_I18N,
  ICON_PX,
  ICON_STROKE,
  OPENCODE_CHAT_TESTIDS,
  OPENCODE_KEY_PREFIX,
  SIZE_SM,
  VARIANT_OUTLINE,
} from './constants'
import { type ChatPartProps, ErrorRow, useChatHost } from './kit'
import { useOpenProviderSettings } from './use-open-settings'

/**
 * The kit's error row; an `opencode:` key message (e.g. "please upgrade") is translated with its `detail`. A rejected
 * credential adds a hint and a button to Settings › OpenCode, where the provider can be reconnected.
 */
export function OpencodeErrorRow({ item, session }: ChatPartProps<ErrorItem>) {
  const t = useT()
  const openSettings = useOpenProviderSettings(useChatHost())
  const message = item.message.startsWith(OPENCODE_KEY_PREFIX)
    ? t(item.message, { detail: item.detail ?? '' })
    : item.message
  const row = <ErrorRow item={{ ...item, message }} session={session} />
  if (item.code !== ERROR_CODE.auth) return row
  return (
    <div className="flex flex-col gap-1.5">
      {row}
      <div data-testid={OPENCODE_CHAT_TESTIDS.reauth} className="flex items-center gap-2 pl-1 text-[12px] text-mu">
        <KeyRound size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-warn" />
        <span className="min-w-0 flex-1">{t(ERROR_I18N.reauthHint)}</span>
        {openSettings ? (
          <Button variant={VARIANT_OUTLINE} size={SIZE_SM} className="h-6 px-2 text-[12px]" onClick={openSettings}>
            {t(ERROR_I18N.reauthAction)}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
