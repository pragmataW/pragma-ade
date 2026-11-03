import { createContext, type RefObject, useContext, useEffect, useState } from 'react'
import { SCROLL_CENTER, SCROLL_SMOOTH, TASK_FLASH_MS } from '../../../constants'
import { useTasksPanelStore } from './store'

/** Where a task card renders: the main transcript reacts to "Show in chat"; the panel's copies do not. */
export const TASK_SURFACES = ['transcript', 'panel'] as const
export type TaskSurface = (typeof TASK_SURFACES)[number]
export const TASK_SURFACE = { transcript: 'transcript', panel: 'panel' } as const
const TaskSurfaceContext = createContext<TaskSurface>(TASK_SURFACE.transcript)
export const TaskSurfaceProvider = TaskSurfaceContext.Provider
export const useTaskSurface = (): TaskSurface => useContext(TaskSurfaceContext)

/**
 * "Show in chat" for one task card of the main transcript: a card on the revealed path opens (so a nested card
 * renders); the revealed card scrolls into view and flashes, then clears the request.
 */
export function useTaskReveal(
  sessionId: string,
  taskId: string,
  ref: RefObject<HTMLElement | null>,
  open: () => void,
): boolean {
  const surface = useTaskSurface()
  const reveal = useTasksPanelStore((s) => (surface === TASK_SURFACE.transcript ? s.reveals[sessionId] : undefined))
  const [flashing, setFlashing] = useState(false)
  const onPath = reveal?.path.includes(taskId) ?? false
  const target = reveal?.taskId === taskId
  const nonce = reveal?.nonce
  useEffect(() => {
    if (!onPath) return
    open()
    if (!target || nonce === undefined) return
    setFlashing(true)
    ref.current?.scrollIntoView?.({ block: SCROLL_CENTER, behavior: SCROLL_SMOOTH })
    const timer = setTimeout(() => {
      setFlashing(false)
      useTasksPanelStore.getState().clearReveal(sessionId, nonce)
    }, TASK_FLASH_MS)
    return () => clearTimeout(timer)
  }, [onPath, target, nonce, open, ref, sessionId])
  return flashing
}
