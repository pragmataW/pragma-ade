import { z } from '@pragma/sdk'
import { OPTION_TYPE, OPTION_TYPES } from './constants'

export const chatOptionValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
export type ChatOptionValue = z.infer<typeof chatOptionValueSchema>

export const chatOptionChoiceSchema = z.object({
  value: chatOptionValueSchema,
  /** Literal label (e.g. a model display name); wins over `labelKey`. */
  label: z.string().optional(),
  labelKey: z.string().optional(),
  /** Rendered in the `warn` colour when current (e.g. skipping permissions). */
  warn: z.boolean().optional(),
})
export type ChatOptionChoice = z.infer<typeof chatOptionChoiceSchema>

/** A session option the adapter describes (`model`, `effort`, `permissionMode`, or provider-specific). */
export const chatOptionDescriptorSchema = z.object({
  key: z.string().min(1),
  type: z.enum(OPTION_TYPES),
  labelKey: z.string(),
  descriptionKey: z.string().optional(),
  values: z.array(chatOptionChoiceSchema).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  default: chatOptionValueSchema,
  current: chatOptionValueSchema,
})
export type ChatOptionDescriptor = z.infer<typeof chatOptionDescriptorSchema>

const inRange = (d: ChatOptionDescriptor, v: number): boolean =>
  (d.min === undefined || v >= d.min) && (d.max === undefined || v <= d.max)

/** True when `v` is a valid value for the descriptor (enum: listed; number: within min/max; boolean: a boolean). */
export function validateOptionValue(d: ChatOptionDescriptor, v: unknown): v is ChatOptionValue {
  switch (d.type) {
    case OPTION_TYPE.enum:
      return (d.values ?? []).some((c) => c.value === v)
    case OPTION_TYPE.boolean:
      return typeof v === 'boolean'
    case OPTION_TYPE.number:
      return typeof v === 'number' && Number.isFinite(v) && inRange(d, v)
    default: {
      const never: never = d.type
      return never
    }
  }
}

/** The descriptor list with `current` of `key` replaced. */
export const withCurrent = (list: ChatOptionDescriptor[], key: string, value: ChatOptionValue): ChatOptionDescriptor[] =>
  list.map((d) => (d.key === key ? { ...d, current: value } : d))
