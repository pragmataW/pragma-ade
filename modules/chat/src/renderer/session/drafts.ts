import { useCallback } from 'react'
import { create } from 'zustand'
import type { ChatFile, ChatImage, ComposerChipEntry } from '../../contract'

/** A chat's unsent composer content: typed text, attachments and review-comment chips. */
export interface ComposerDraft {
  text: string
  images: ChatImage[]
  files: ChatFile[]
  chips: ComposerChipEntry[]
}

export const DRAFT_FIELD = { text: 'text', images: 'images', files: 'files', chips: 'chips' } as const

type DraftUpdate<V> = V | ((current: V) => V)

interface DraftsState {
  drafts: Record<string, ComposerDraft>
}

const EMPTY_DRAFT: ComposerDraft = { text: '', images: [], files: [], chips: [] }

/**
 * Drafts by session id, outside the composer: only the active chat view is mounted (switching chats remounts it),
 * so component state would lose what the user had typed.
 */
const useDrafts = create<DraftsState>(() => ({ drafts: {} }))

const isEmpty = (d: ComposerDraft) => !d.text && !d.images.length && !d.files.length && !d.chips.length

function updateDraft<K extends keyof ComposerDraft>(
  sessionId: string,
  key: K,
  update: DraftUpdate<ComposerDraft[K]>,
): void {
  useDrafts.setState(({ drafts }) => {
    const current = drafts[sessionId] ?? EMPTY_DRAFT
    const value =
      typeof update === 'function' ? (update as (v: ComposerDraft[K]) => ComposerDraft[K])(current[key]) : update
    const { [sessionId]: _old, ...rest } = drafts
    const next = { ...current, [key]: value }
    return { drafts: isEmpty(next) ? rest : { ...rest, [sessionId]: next } }
  })
}

/** One field of a session's draft, with a `useState`-like setter. */
export function useDraftField<K extends keyof ComposerDraft>(
  sessionId: string,
  key: K,
): readonly [ComposerDraft[K], (update: DraftUpdate<ComposerDraft[K]>) => void] {
  const value = useDrafts((s) => (s.drafts[sessionId] ?? EMPTY_DRAFT)[key])
  const set = useCallback(
    (update: DraftUpdate<ComposerDraft[K]>) => updateDraft(sessionId, key, update),
    [sessionId, key],
  )
  return [value, set] as const
}

/** Tests: forget every draft. */
export function resetComposerDrafts(): void {
  useDrafts.setState({ drafts: {} })
}
