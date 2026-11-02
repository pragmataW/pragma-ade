import { useEffect, useState } from 'react'
import { type ChatSupport, UNSUPPORTED_REASON } from '../../contract'
import { useChatHost } from '../host-adapter'

/** `chat.checkSupport` for the selected profile (null while unknown or without a profile). */
export function useChatSupport(profileId: string | null): ChatSupport | null {
  const host = useChatHost()
  const [support, setSupport] = useState<{ profileId: string; value: ChatSupport } | null>(null)
  useEffect(() => {
    if (!profileId) return
    let live = true
    host
      .checkSupport(profileId)
      .catch((): ChatSupport => ({ ok: false, reasonKey: UNSUPPORTED_REASON.noCapability }))
      .then((value) => {
        if (live) setSupport({ profileId, value })
      })
    return () => {
      live = false
    }
  }, [host, profileId])
  return support && support.profileId === profileId ? support.value : null
}
