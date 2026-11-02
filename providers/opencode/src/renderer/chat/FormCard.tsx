import type { CustomItem } from '@pragma/module-chat/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { MessageCircleQuestion } from '@pragma/ui/icons'
import { useState } from 'react'
import { FORM_I18N, ICON_PX, ICON_STROKE, OPENCODE_CHAT_TESTIDS as IDS, SIZE_SM } from './constants'
import { FormFieldInput, initialValue } from './form-fields'
import type { ChatPartProps } from './kit'
import { type FormAnswer, type FormPayload, type FormValue, formPayloadSchema } from './payloads'

type Values = Record<string, FormValue | undefined>

const answerOf = (values: Values): FormAnswer =>
  Object.fromEntries(Object.entries(values).filter((e): e is [string, FormValue] => e[1] !== undefined))

function FormBody({ form, item, session }: { form: FormPayload } & ChatPartProps<CustomItem>) {
  const t = useT()
  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(form.fields.map((f) => [f.key, initialValue(f)])),
  )
  const [busy, setBusy] = useState(false)
  const done = item.resolved !== undefined || !item.awaitsResponse
  const disabled = done || busy
  const respond = (payload: unknown) => {
    setBusy(true)
    session.respond(form.formId, payload).catch(() => setBusy(false))
  }
  return (
    <>
      <div className="flex flex-col gap-3 px-3 py-2.5">
        {form.fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-tx">
              {f.title ?? f.key}
              {f.required ? <span className="ml-1.5 text-[11px] text-warn">{t(FORM_I18N.required)}</span> : null}
            </span>
            {f.description ? <span className="text-[11.5px] text-mu">{f.description}</span> : null}
            <FormFieldInput
              field={f}
              value={values[f.key]}
              disabled={disabled}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-bd px-3 py-2">
        {item.resolved ? (
          <span data-testid={IDS.formOutcome} className="text-[12px] text-mu">
            {t(FORM_I18N.outcome[item.resolved])}
          </span>
        ) : (
          <>
            <Button
              size={SIZE_SM}
              variant="ghost"
              data-testid={IDS.formCancel}
              disabled={disabled}
              onClick={() => respond({ cancel: true })}
            >
              {t(FORM_I18N.cancel)}
            </Button>
            <Button
              size={SIZE_SM}
              data-testid={IDS.formSubmit}
              disabled={disabled}
              onClick={() => respond(answerOf(values))}
            >
              {t(FORM_I18N.submit)}
            </Button>
          </>
        )}
      </div>
    </>
  )
}

/** `custom:opencode.form`: OpenCode's native question form, answered through `session.respond` (§10.3). */
export function FormCard({ item, session }: ChatPartProps<CustomItem>) {
  const form = formPayloadSchema.safeParse(item.data)
  if (!form.success) return null
  return (
    <div
      data-testid={IDS.form}
      data-state={item.resolved ?? 'pending'}
      className="overflow-hidden rounded-lg border border-ac/50 bg-el"
    >
      <div className="flex items-center gap-2 border-b border-bd px-3 py-2">
        <MessageCircleQuestion size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-act" />
        <span className="text-[12.5px] font-semibold text-tx">{form.data.title}</span>
      </div>
      <FormBody form={form.data} item={item} session={session} />
    </div>
  )
}
