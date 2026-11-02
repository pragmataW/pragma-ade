import type { ErrorItem } from '@pragma/module-chat/contract'
import { useT } from '@pragma/sdk/renderer'
import { OPENCODE_KEY_PREFIX } from './constants'
import { type ChatPartProps, ErrorRow } from './kit'

/** The kit's error row; an `opencode:` key message (e.g. "please upgrade") is translated with its `detail`. */
export function OpencodeErrorRow({ item, session }: ChatPartProps<ErrorItem>) {
  const t = useT()
  const message = item.message.startsWith(OPENCODE_KEY_PREFIX)
    ? t(item.message, { detail: item.detail ?? '' })
    : item.message
  return <ErrorRow item={{ ...item, message }} session={session} />
}
