import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { ShellState, ShellStore } from './shell-store'

export const ShellStoreContext = createContext<ShellStore | null>(null)

export class MissingShellStoreError extends Error {}

export function useShellStore(): ShellStore {
  const store = useContext(ShellStoreContext)
  if (!store) throw new MissingShellStoreError('shell components need <ShellStoreContext>')
  return store
}

export const useShell = <T,>(select: (s: ShellState) => T): T => useStore(useShellStore(), select)
