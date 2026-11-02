import { useCallback, useEffect, useState } from 'react'
import { type CliIntegrationStatus, cliIntegrationIpc } from '../contract'
import { cliRuntime } from './runtime'

export interface CliIntegrationState {
  status: CliIntegrationStatus | null
  busy: boolean
  /** Error message of the last failed action (shown under the sections). */
  error: string | null
  installCli(dir?: string): Promise<void>
  uninstallCli(): Promise<void>
  installSkills(providerIds: string[]): Promise<void>
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Status from `getStatus`, kept fresh by `statusChanged`; every action reports its own result or error. */
export function useCliIntegrationStatus(): CliIntegrationState {
  const { ipc } = cliRuntime().ctx
  const [status, setStatus] = useState<CliIntegrationStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    ipc
      .invoke(cliIntegrationIpc.getStatus, undefined)
      .then((s) => live && setStatus(s))
      .catch((e: unknown) => live && setError(messageOf(e)))
    const sub = ipc.subscribe(cliIntegrationIpc.statusChanged, setStatus)
    return () => {
      live = false
      sub.dispose()
    }
  }, [ipc])
  const run = useCallback(async (action: () => Promise<CliIntegrationStatus>) => {
    setBusy(true)
    setError(null)
    try {
      setStatus(await action())
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }, [])
  return {
    status,
    busy,
    error,
    installCli: (dir) => run(() => ipc.invoke(cliIntegrationIpc.installCli, dir ? { dir } : {})),
    uninstallCli: () => run(() => ipc.invoke(cliIntegrationIpc.uninstallCli, undefined)),
    installSkills: (providerIds) => run(() => ipc.invoke(cliIntegrationIpc.installSkills, { providerIds })),
  }
}
