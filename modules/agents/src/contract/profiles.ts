import { z } from '@pragma/sdk'
import { ENV_KEY_RE, NUL_CHAR, PROFILE_NAME_MAX, RESERVED_ENV_PREFIX } from './constants'

/** Profile environment: valid names, no reserved `PRAGMA_` keys, no NUL in values. */
export const envSchema = z.record(
  z
    .string()
    .regex(ENV_KEY_RE)
    .refine((k) => !k.startsWith(RESERVED_ENV_PREFIX)),
  z.string().refine((v) => !v.includes(NUL_CHAR)),
)
export type ProfileEnv = z.infer<typeof envSchema>

export const agentProfileSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  /** null for built-ins → the UI shows `t(displayNameKey)`. */
  name: z.string().nullable(),
  /** null when the provider is unavailable. */
  displayNameKey: z.string().nullable(),
  /** Stored overrides. */
  commandOverride: z.string().nullable(),
  argsOverride: z.string().nullable(),
  /** Effective values. */
  command: z.string(),
  args: z.array(z.string()),
  /** Built-ins only: the provider's stock command line. */
  stockCommand: z.string().nullable(),
  stockArgs: z.array(z.string()).nullable(),
  env: envSchema,
  enabled: z.boolean(),
  isDefault: z.boolean(),
  isBuiltin: z.boolean(),
  sortOrder: z.number().int(),
  /** Provider registered and has the `launch` capability. */
  available: z.boolean(),
})
export type AgentProfile = z.infer<typeof agentProfileSchema>

export const providerInfoSchema = z.object({
  id: z.string(),
  displayNameKey: z.string(),
  icon: z.string(),
  defaultCommand: z.string(),
  defaultArgs: z.array(z.string()),
  /** Its `launch` capability seeds a built-in profile. */
  seeded: z.boolean(),
})
export type ProviderInfo = z.infer<typeof providerInfoSchema>

const profileName = z.string().trim().min(1).max(PROFILE_NAME_MAX)

export const createProfileInputSchema = z.object({
  providerId: z.string().min(1),
  name: profileName,
  command: z.string().trim().min(1),
  args: z.string().default(''),
  env: envSchema.default({}),
})
export type CreateProfileInput = z.input<typeof createProfileInputSchema>

export const updateProfilePatchSchema = z.object({
  name: profileName.optional(),
  command: z.string().trim().nullable().optional(),
  args: z.string().nullable().optional(),
  env: envSchema.optional(),
  enabled: z.boolean().optional(),
})
export type UpdateProfilePatch = z.input<typeof updateProfilePatchSchema>
