import { createContext, type ReactNode, useContext } from 'react'
import { I18nextProvider } from 'react-i18next'
import type { RendererHost } from '../runtime/renderer/renderer-host'
import type { RendererContext } from './types'

export class MissingRendererHostError extends Error {}

export const RendererHostContext = createContext<RendererHost | null>(null)
export const ModuleContext = createContext<RendererContext | null>(null)

export function useRendererHost(): RendererHost {
  const host = useContext(RendererHostContext)
  if (!host) throw new MissingRendererHostError('useRendererHost outside <RendererHostProvider>')
  return host
}

/** The `RendererContext` of the module whose registered component is rendering. */
export function useRendererContext<S = unknown>(): RendererContext<S> {
  const ctx = useContext(ModuleContext)
  if (!ctx) throw new MissingRendererHostError('useRendererContext outside a module component')
  return ctx as RendererContext<S>
}

export function RendererHostProvider({ host, children }: { host: RendererHost; children?: ReactNode }) {
  return (
    <RendererHostContext.Provider value={host}>
      <I18nextProvider i18n={host.i18n}>{children}</I18nextProvider>
    </RendererHostContext.Provider>
  )
}
