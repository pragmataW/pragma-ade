import {
  type FormAnswer,
  type FormField,
  type FormValue,
  formAnswerSchema,
  formCancelSchema,
  FORM_FIELD_TYPE as T,
} from '../../../renderer/chat/payloads'

const isString = (v: FormValue): v is string => typeof v === 'string'
const allowed = (f: FormField, v: string): boolean =>
  f.custom === true || !f.options?.length || f.options.some((o) => o.value === v)

/** Whether `v` is a valid value for `f` (types, option values unless `custom`). */
function validValue(f: FormField, v: FormValue): boolean {
  switch (f.type) {
    case T.string:
      return isString(v) && allowed(f, v)
    case T.number:
      return typeof v === 'number' && Number.isFinite(v)
    case T.integer:
      return Number.isInteger(v)
    case T.boolean:
      return typeof v === 'boolean'
    case T.multiselect:
      return Array.isArray(v) && v.every((x) => allowed(f, x))
    case T.external:
      return false
    default: {
      const never: never = f.type
      return never
    }
  }
}

export type FormResponse = { cancel: true } | { answer: FormAnswer }

/** A FormCard payload checked against the form: `{cancel:true}`, or an answer with only known, valid, required keys. */
export function parseFormResponse(fields: FormField[], payload: unknown): FormResponse | null {
  if (formCancelSchema.safeParse(payload).success) return { cancel: true }
  const parsed = formAnswerSchema.safeParse(payload)
  if (!parsed.success) return null
  const answer = parsed.data
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const known = Object.entries(answer).every(([k, v]) => {
    const f = byKey.get(k)
    return f !== undefined && validValue(f, v)
  })
  const complete = fields.every((f) => !f.required || answer[f.key] !== undefined)
  return known && complete ? { answer } : null
}
