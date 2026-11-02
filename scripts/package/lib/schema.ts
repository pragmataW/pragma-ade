import { z } from 'zod'

export const DoctorReportSchema = z.object({
  node: z.string(),
  nodeOk: z.boolean(),
  pnpm: z.string().nullable(),
  npm: z.string().nullable(),
  hostArch: z.string(),
  macos: z.string().nullable(),
  rosetta: z.boolean(),
  docker: z.object({ cli: z.string().nullable(), daemon: z.boolean(), serverVersion: z.string().nullable() }),
  wine: z.string().nullable(),
  freeDiskGb: z.number(),
  ok: z.boolean(),
})
export type DoctorReport = z.infer<typeof DoctorReportSchema>

export const ExtraResourceSchema = z.object({ from: z.string().min(1), to: z.string().min(1) })
export type ExtraResource = z.infer<typeof ExtraResourceSchema>
export const PragmaPackageSchema = z.object({ extraResources: z.array(ExtraResourceSchema).default([]) })
const DepsSchema = z.record(z.string(), z.string())
export const PackageJsonSchema = z
  .object({
    name: z.string(),
    version: z.string().optional(),
    type: z.enum(['module', 'commonjs']).optional(),
    main: z.string().optional(),
    exports: z.unknown().optional(),
    dependencies: DepsSchema.optional(),
    optionalDependencies: DepsSchema.optional(),
    scripts: DepsSchema.optional(),
    pragma: z
      .object({
        id: z.string().optional(),
        kind: z.string().optional(),
        build: z.string().optional(),
        package: PragmaPackageSchema.optional(),
      })
      .loose()
      .optional(),
  })
  .loose()
export type PackageJson = z.infer<typeof PackageJsonSchema>

export const WorkspaceYamlSchema = z.object({ packages: z.array(z.string()).default([]) }).loose()
