import { z } from 'zod'
import { I18N_KEY_PATTERN, MODULE_ID_PATTERN } from './patterns.ts'

export const MODULE_KINDS = ['feature', 'provider'] as const
export type ModuleKind = (typeof MODULE_KINDS)[number]

export const RESERVED_MODULE_IDS = ['core', 'pragma', 'sdk', 'ui', 'shell', 'app'] as const
/** Globs (relative to the package) hashed for incremental `pragma.build` runs. */
export const BUILD_INPUT_DEFAULTS = ['src/**', 'package.json'] as const

const RESERVED = new Set<string>(RESERVED_MODULE_IDS)

export const ExtraResourceSchema = z.object({ from: z.string().min(1), to: z.string().min(1) })
export type ExtraResource = z.infer<typeof ExtraResourceSchema>

const PackageFieldSchema = z.object({ extraResources: z.array(ExtraResourceSchema).default([]) })

const buildFields = {
  /** npm script name (not a command) run by the generator before dev/build/test. */
  build: z.string().min(1).optional(),
  buildInputs: z.array(z.string().min(1)).optional(),
  buildOutputs: z.array(z.string().min(1)).optional(),
  package: PackageFieldSchema.optional(),
}

export const ModuleManifestSchema = z
  .object({
    id: z
      .string()
      .regex(MODULE_ID_PATTERN)
      .refine((id) => !RESERVED.has(id), { message: 'reserved module id' }),
    kind: z.enum(MODULE_KINDS),
    displayNameKey: z.string().regex(I18N_KEY_PATTERN),
    dependsOn: z.array(z.string()).default([]),
    optionalDependsOn: z.array(z.string()).default([]),
    core: z.boolean().default(false),
    ...buildFields,
  })
  .strict()
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>

/** Manifest of `modules/*\/packages/*` and `providers/*\/packages/*` (§10.2). */
export const SubPackageManifestSchema = z.object(buildFields).strict()
export type SubPackageManifest = z.infer<typeof SubPackageManifestSchema>
