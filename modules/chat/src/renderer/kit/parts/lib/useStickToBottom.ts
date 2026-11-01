import { type RefObject, useCallback, useState } from 'react'
import { STICK_BOTTOM_PX } from '../../../../constants'

/** Whether the scroller is within `STICK_BOTTOM_PX` of its end (then new rows keep it pinned). */
export function useStickToBottom(ref: RefObject<HTMLElement | null>) {
  const [atBottom, setAtBottom] = useState(true)
  const onScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_BOTTOM_PX)
  }, [ref])
  return { atBottom, onScroll }
}
