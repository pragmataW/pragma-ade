import { useCallback, useEffect, useState } from 'react'
import {
  type ConnectionList,
  type ConnectionRequest,
  connectionListSchema,
  type OauthAttempt,
  type OauthStatus,
  CONNECTION_OPS as OP,
  oauthAttemptSchema,
  oauthStatusSchema,
} from '../connections'
import { IPC_ERROR_PREFIX_RE } from '../constants'

export type Call = (request: ConnectionRequest) => Promise<unknown>

/** The provider list (`list`), reloadable; `error` is the last failure's message. */
export function useConnections(call: Call) {
  const [list, setList] = useState<ConnectionList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(async () => {
    try {
      setList(connectionListSchema.parse(await call({ op: OP.list })))
      setError(null)
    } catch (e) {
      setError(messageOf(e))
    }
  }, [call])
  useEffect(() => {
    void reload()
  }, [reload])
  return { list, error, reload }
}

/** An Error's message without Electron's IPC wrapper ("Error invoking remote method …: Error: …"). */
export function messageOf(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e)
  return text.replace(IPC_ERROR_PREFIX_RE, '')
}

export const startOauth = async (call: Call, integrationID: string, methodID: string): Promise<OauthAttempt> =>
  oauthAttemptSchema.parse(await call({ op: OP.oauthStart, integrationID, methodID }))

export const oauthStatus = async (call: Call, integrationID: string, attemptID: string): Promise<OauthStatus> =>
  oauthStatusSchema.parse(await call({ op: OP.oauthStatus, integrationID, attemptID }))
