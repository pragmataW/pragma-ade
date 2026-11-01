import { ProjectsRendererServiceToken, type Worktree } from '@pragma/module-projects/contract'
import type { IpcContract, IpcEventContract } from '@pragma/sdk'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { EditorIpc, EditorIpcEvents, type EditorSettings, type EditorStatus } from '../contract'
import { editorRuntime } from './runtime'

/** `invoke(query)` once, then follow `event` (the latest value wins). */
export function useIpcValue<I, T>(
  query: IpcContract<I, T>,
  input: I,
  event: IpcEventContract<T>,
  key = '',
): T | undefined {
  const { ipc } = editorRuntime().ctx
  const [value, setValue] = useState<T | undefined>(undefined)
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-subscribe only when the key changes
  useEffect(() => {
    let live = true
    const sub = ipc.subscribe(event, (v) => live && setValue(v))
    void ipc.invoke(query, input).then((v) => live && setValue(v))
    return () => {
      live = false
      sub.dispose()
    }
  }, [key])
  return value
}

/** The install/server status (`editor.getStatus` + `editor.statusChanged`). */
export const useEditorStatus = (): EditorStatus | undefined =>
  useIpcValue(EditorIpc.getStatus, {}, EditorIpcEvents.statusChanged)

/** The editor settings section, re-rendering on change. */
export function useEditorSettings(): EditorSettings {
  const { settings } = editorRuntime().ctx
  return useSyncExternalStore(
    (cb) => {
      const sub = settings.subscribe(cb)
      return () => sub.dispose()
    },
    () => settings.get(),
  )
}

/** 01's renderer projects service: the active worktree. */
export function useActiveWorktree(): Worktree | null {
  const projects = editorRuntime().ctx.services.get(ProjectsRendererServiceToken)
  return useSyncExternalStore(
    (cb) => projects.subscribe(cb),
    () => projects.getActiveWorktree(),
  )
}
