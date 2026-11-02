import { create } from 'zustand'
import type { ScmErrorCode } from '../../contract'

/** A failed operation, shown in the panel's error banner until dismissed or the next operation. */
export interface ScmFailure {
  code: ScmErrorCode
  detail: string
}

/** Per worktree: the commit message draft, the last failure and how many operations are running. */
export interface ScmFeedback {
  message: string
  error: ScmFailure | null
  running: number
}

const INITIAL: ScmFeedback = { message: '', error: null, running: 0 }

export interface ScmStoreState {
  feedback: Record<string, ScmFeedback>
  setMessage(worktreeId: string, message: string): void
  setError(worktreeId: string, error: ScmFailure | null): void
  /** +1 when an operation starts, -1 when it ends. */
  track(worktreeId: string, delta: number): void
}

export const feedbackOf = (s: Pick<ScmStoreState, 'feedback'>, worktreeId: string): ScmFeedback =>
  s.feedback[worktreeId] ?? INITIAL

export const useScmStore = create<ScmStoreState>()((set) => {
  const patch = (id: string, fn: (f: ScmFeedback) => Partial<ScmFeedback>) =>
    set((s) => ({ feedback: { ...s.feedback, [id]: { ...feedbackOf(s, id), ...fn(feedbackOf(s, id)) } } }))
  return {
    feedback: {},
    setMessage: (id, message) => patch(id, () => ({ message })),
    setError: (id, error) => patch(id, () => ({ error })),
    track: (id, delta) => patch(id, (f) => ({ running: Math.max(0, f.running + delta) })),
  }
})

export const useScmFeedback = (worktreeId: string): ScmFeedback => useScmStore((s) => feedbackOf(s, worktreeId))
