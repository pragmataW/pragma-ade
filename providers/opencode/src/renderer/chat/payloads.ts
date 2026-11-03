/**
 * OpenCode custom chat event payloads: one source of truth for main (emits) and renderer (draws). No React, no Node.
 * A form is `custom{type: CUSTOM.form, eventId: formId, awaitsResponse: true}`; it is closed by 11a's
 * `response-resolved{eventId, outcome}` (not a separate custom event).
 */
import { z } from '@pragma/sdk'

export const CUSTOM = { form: 'opencode.form', notice: 'opencode.notice' } as const

/** A session change shown inline: files reverted to before a message, or the chat continued in a fork. */
export const NOTICE = { reverted: 'reverted', forked: 'forked' } as const
export const noticePayloadSchema = z.discriminatedUnion('notice', [
  z.object({ notice: z.literal(NOTICE.reverted), messageId: z.string(), files: z.array(z.string()) }),
  z.object({ notice: z.literal(NOTICE.forked), from: z.string(), to: z.string() }),
])
export type NoticePayload = z.infer<typeof noticePayloadSchema>

const FIELD_TYPES = ['string', 'number', 'integer', 'boolean', 'multiselect', 'external'] as const

export const formOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string().optional(),
})
export type FormOption = z.infer<typeof formOptionSchema>

export const formFieldSchema = z.looseObject({
  key: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  title: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(formOptionSchema).optional(),
  custom: z.boolean().optional(),
  default: z.unknown().optional(),
})
export type FormField = z.infer<typeof formFieldSchema>
export type FormFieldType = FormField['type']
export const FORM_FIELD_TYPE = Object.fromEntries(FIELD_TYPES.map((t) => [t, t])) as {
  [K in FormFieldType]: K
}

export const formPayloadSchema = z.object({
  formId: z.string(),
  title: z.string(),
  fields: z.array(formFieldSchema),
})
export type FormPayload = z.infer<typeof formPayloadSchema>

export const formValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
export type FormValue = z.infer<typeof formValueSchema>
export const formAnswerSchema = z.record(z.string(), formValueSchema)
export type FormAnswer = z.infer<typeof formAnswerSchema>
/** What `FormCard` sends through `respond`: an answer, or a skip. */
export const formCancelSchema = z.object({ cancel: z.literal(true) })
export const formResponseSchema = z.union([formCancelSchema, formAnswerSchema])
