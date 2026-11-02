import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Input } from '@pragma/ui/components/input'
import { ExternalLink, KeyRound, LoaderCircle, LogIn } from '@pragma/ui/icons'
import { useEffect, useState } from 'react'
import {
  OAUTH_MODE,
  OAUTH_STATUS,
  type OauthAttempt,
  CONNECTION_OPS as OP,
  type ProviderConnection,
} from '../connections'
import {
  CONNECTIONS_I18N as C,
  ICON_PX,
  ICON_STROKE,
  OPENCODE_CHAT_TESTIDS as IDS,
  INPUT_PASSWORD,
  OAUTH_POLL_MS,
  ROLE,
  SIZE_SM,
  VARIANT_GHOST,
  VARIANT_OUTLINE,
} from '../constants'
import { useChatHost } from '../kit'
import { type Call, messageOf, oauthStatus, startOauth } from './use-connections'

/** Polls an OAuth attempt until it ends; `onDone` gets null on success or the failure's message. */
function useOauthPoll(
  call: Call,
  integrationID: string,
  attempt: OauthAttempt | null,
  onDone: (e: string | null) => void,
) {
  const t = useT()
  useEffect(() => {
    if (!attempt || attempt.mode !== OAUTH_MODE.auto) return
    const timer = setInterval(() => {
      void oauthStatus(call, integrationID, attempt.attemptID)
        .then((s) => {
          if (s.status === OAUTH_STATUS.complete) onDone(null)
          else if (s.status !== OAUTH_STATUS.pending) onDone(s.message ?? t(C.oauthFailed))
        })
        .catch((e: unknown) => onDone(messageOf(e)))
    }, OAUTH_POLL_MS)
    return () => clearInterval(timer)
  }, [attempt, call, integrationID, onDone, t])
}

/**
 * How to connect one provider: an API key field and/or OAuth / device-code sign-in (opened in the browser through the
 * SDK; a pasted code completes `code` flows). `onConnected` reloads the list.
 */
export function ConnectPanel({
  provider,
  call,
  onConnected,
}: {
  provider: ProviderConnection
  call: Call
  onConnected(): void
}) {
  const t = useT()
  const host = useChatHost()
  const [key, setKey] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<OauthAttempt | null>(null)
  const run = async (task: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(messageOf(e))
    } finally {
      setBusy(false)
    }
  }
  const done = (e: string | null) => {
    setAttempt(null)
    if (e) setError(e)
    else onConnected()
  }
  useOauthPoll(call, provider.id, attempt, done)
  const saveKey = () =>
    run(async () => {
      await call({ op: OP.keyConnect, integrationID: provider.id, key: key.trim() })
      setKey('')
      onConnected()
    })
  const signIn = (methodID: string) =>
    run(async () => {
      const a = await startOauth(call, provider.id, methodID)
      setAttempt(a)
      host.openExternal(a.url)
    })
  const complete = (a: OauthAttempt) =>
    run(async () => {
      await call({ op: OP.oauthComplete, integrationID: provider.id, attemptID: a.attemptID, code: code.trim() })
      done(null)
    })
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-bd bg-bg px-3 py-2.5">
      {provider.key ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (key.trim()) void saveKey()
          }}
        >
          <KeyRound size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-mu" />
          <Input
            type={INPUT_PASSWORD}
            data-testid={IDS.providerKeyInput}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t(C.keyPlaceholder, { name: provider.name })}
            aria-label={t(C.keyLabel)}
            className="h-7 flex-1 font-mono text-[12px]"
            autoComplete="off"
          />
          <Button
            type="submit"
            size={SIZE_SM}
            data-testid={IDS.providerKeySave}
            disabled={busy || !key.trim()}
            className="h-7"
          >
            {t(C.save)}
          </Button>
        </form>
      ) : null}
      {provider.oauth.length > 0 && !attempt ? (
        <div className="flex flex-wrap items-center gap-2">
          {provider.oauth.map((m) => (
            <Button
              key={m.id}
              variant={VARIANT_OUTLINE}
              size={SIZE_SM}
              disabled={busy}
              onClick={() => void signIn(m.id)}
              className="h-7 gap-1.5"
            >
              <LogIn size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
              {m.label}
            </Button>
          ))}
        </div>
      ) : null}
      {attempt ? (
        <div data-testid={IDS.providerOauth} className="flex flex-col gap-2 text-[12px] text-mu">
          <span className="flex items-center gap-2 text-tx">
            {attempt.mode === OAUTH_MODE.auto ? (
              <LoaderCircle size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="animate-spin text-act" />
            ) : null}
            {attempt.instructions || t(C.oauthWaiting)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={VARIANT_OUTLINE}
              size={SIZE_SM}
              className="h-7 gap-1.5"
              onClick={() => host.openExternal(attempt.url)}
            >
              <ExternalLink size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
              {t(C.oauthOpen)}
            </Button>
            {attempt.mode === OAUTH_MODE.code ? (
              <>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t(C.oauthCode)}
                  aria-label={t(C.oauthCode)}
                  className="h-7 w-48 font-mono text-[12px]"
                />
                <Button
                  size={SIZE_SM}
                  className="h-7"
                  disabled={busy || !code.trim()}
                  onClick={() => void complete(attempt)}
                >
                  {t(C.oauthComplete)}
                </Button>
              </>
            ) : null}
            <Button
              variant={VARIANT_GHOST}
              size={SIZE_SM}
              className="h-7"
              onClick={() =>
                void run(async () => {
                  await call({ op: OP.oauthCancel, integrationID: provider.id, attemptID: attempt.attemptID })
                  setAttempt(null)
                })
              }
            >
              {t(C.cancel)}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <span role={ROLE.alert} data-testid={IDS.providerError} className="text-[12px] text-err">
          {error}
        </span>
      ) : null}
    </div>
  )
}
