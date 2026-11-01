import { z } from '@pragma/sdk'
import { DEFAULT_NAME, MAX_NAME_LENGTH } from '../constants'

/** Every type is `z.infer` of a schema: one source for validation and typing. */
export const ExampleSettingsSchema = z.object({ name: z.string().max(MAX_NAME_LENGTH).default(DEFAULT_NAME) })
export type ExampleSettings = z.infer<typeof ExampleSettingsSchema>

export const HelloInputSchema = z.object({ name: z.string().max(MAX_NAME_LENGTH).optional() })
export const HelloOutputSchema = z.object({ text: z.string() })
export const ItemSchema = z.object({ id: z.number(), label: z.string() })
export type Item = z.infer<typeof ItemSchema>
export const AddItemInputSchema = z.object({ label: z.string().min(1).max(MAX_NAME_LENGTH) })
export const ItemAddedSchema = z.object({ item: ItemSchema, total: z.number() })
export type ItemAdded = z.infer<typeof ItemAddedSchema>
export const CountSchema = z.object({ count: z.number() })
