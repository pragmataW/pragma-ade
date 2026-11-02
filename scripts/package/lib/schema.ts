import { z } from 'zod'
import { PROBE_CHECK, SEVERITY, STATUS } from '../constants.ts'

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

export const MODULE_TYPES = ['module', 'commonjs'] as const
export const ModuleTypeSchema = z.enum(MODULE_TYPES)

export const ExtraResourceSchema = z.object({ from: z.string().min(1), to: z.string().min(1) })
export type ExtraResource = z.infer<typeof ExtraResourceSchema>
export const PragmaPackageSchema = z.object({ extraResources: z.array(ExtraResourceSchema).default([]) })
const DepsSchema = z.record(z.string(), z.string())
export const PackageJsonSchema = z
  .object({
    name: z.string(),
    version: z.string().optional(),
    type: ModuleTypeSchema.optional(),
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

export const ProbeEntryResultSchema = z.object({
  name: z.string(),
  ok: z.boolean(),
  op: z.string(),
  error: z.string().optional(),
})
export const ProbeResultSchema = z.object({
  ok: z.boolean(),
  results: z.array(ProbeEntryResultSchema),
  skipped: z.string().optional(),
})
export type ProbeResult = z.infer<typeof ProbeResultSchema>

export const TargetIdSchema = z.enum(['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64'])
export const CHECK = {
  binariesArch: 'binaries.arch',
  exeArch: 'exe.arch',
  nativesPresent: 'natives.present',
  nativesUnpacked: 'natives.unpacked',
  asarMain: 'asar.main',
  resourcesPresent: 'resources.present',
  execBit: 'exec-bit',
  codesignVerify: 'codesign.verify',
  dmgMount: 'dmg.mount',
  debControlArch: 'deb.control.arch',
  appimageFormat: 'appimage.format',
  nsisFormat: 'nsis.format',
  probe: PROBE_CHECK,
} as const
export const AUDIT_CHECK_IDS = [
  CHECK.binariesArch,
  CHECK.exeArch,
  CHECK.nativesPresent,
  CHECK.nativesUnpacked,
  CHECK.asarMain,
  CHECK.resourcesPresent,
  CHECK.execBit,
  CHECK.codesignVerify,
  CHECK.dmgMount,
  CHECK.debControlArch,
  CHECK.appimageFormat,
  CHECK.nsisFormat,
  CHECK.probe,
] as const
export const AuditCheckIdSchema = z.enum(AUDIT_CHECK_IDS)
export type AuditCheckId = z.infer<typeof AuditCheckIdSchema>
export const SEVERITIES = [SEVERITY.error, SEVERITY.warn] as const
export const AuditCheckSchema = z.object({
  id: AuditCheckIdSchema,
  subject: z.string().optional(),
  ok: z.boolean(),
  severity: z.enum(SEVERITIES),
  detail: z.string(),
})
export type AuditCheck = z.infer<typeof AuditCheckSchema>
export const NativeFileReportSchema = z.object({ path: z.string(), fileCmd: z.string(), ok: z.boolean() })
export type NativeFileReport = z.infer<typeof NativeFileReportSchema>
export const AuditExpectationsSchema = z.object({
  productName: z.string(),
  executableName: z.string(),
  resourceDests: z.array(z.string()),
  nativePackages: z.array(z.string()),
  main: z.string(),
})
export type AuditExpectations = z.infer<typeof AuditExpectationsSchema>
export const ArtifactSchema = z.object({ path: z.string(), bytes: z.number(), sha256: z.string() })
export const AuditResultSchema = z.object({
  target: TargetIdSchema,
  ok: z.boolean(),
  artifacts: z.array(ArtifactSchema),
  checks: z.array(AuditCheckSchema),
  nativeFiles: z.array(NativeFileReportSchema),
  probe: ProbeResultSchema.optional(),
})
export type AuditResult = z.infer<typeof AuditResultSchema>

export const ExternalRefSchema = z.object({
  name: z.string(),
  version: z.string(),
  /** The installed package dir the bundle was built against. */
  sourceDir: z.string(),
  /** Path inside the package; '' is the package entry. */
  subpath: z.string(),
})
export type ExternalRef = z.infer<typeof ExternalRefSchema>

export const NATIVE_SOURCES = ['prebuilt', 'cache', 'host-compile', 'docker-compile'] as const
export const NativeResolutionSchema = z.object({
  name: z.string(),
  version: z.string(),
  source: z.enum(NATIVE_SOURCES),
  files: z.array(z.string()),
  glibcMax: z.string().optional(),
})
export type NativeResolution = z.infer<typeof NativeResolutionSchema>

export const TARGET_STATUSES = [STATUS.ok, STATUS.failed] as const
export const TargetReportSchema = z.object({
  status: z.enum(TARGET_STATUSES),
  error: z.string().optional(),
  artifacts: z.array(z.string()),
  externals: z.array(ExternalRefSchema),
  resources: z.array(z.object({ dest: z.string(), declaredBy: z.string() })),
  natives: z.array(NativeResolutionSchema),
  warnings: z.array(z.string()).default([]),
  expectations: AuditExpectationsSchema.optional(),
  audit: AuditResultSchema.optional(),
})
export type TargetReport = z.infer<typeof TargetReportSchema>

export const SmokeSummarySchema = z.object({
  passed: z.number(),
  failed: z.number(),
  skipped: z.array(z.object({ title: z.string(), reason: z.string() })),
  failures: z.array(z.object({ title: z.string(), error: z.string() })).default([]),
})
export type SmokeSummary = z.infer<typeof SmokeSummarySchema>

export const DistManifestSchema = z.object({
  generatedAt: z.string(),
  repoCommit: z.string().nullable(),
  appVersion: z.string(),
  electronVersion: z.string(),
  electronBuilderVersion: z.string(),
  targets: z.partialRecord(TargetIdSchema, TargetReportSchema),
  unpackagedBuilds: z.array(z.object({ ownerId: z.string(), packageName: z.string() })),
  warnings: z.array(z.string()),
  smoke: SmokeSummarySchema.optional(),
})
export type DistManifest = z.infer<typeof DistManifestSchema>

/** The parts of Playwright's JSON report the smoke summary reads. */
const PwResultSchema = z
  .object({ status: z.string(), error: z.object({ message: z.string().optional() }).loose().optional() })
  .loose()
const PwTestSchema = z
  .object({
    projectName: z.string().optional(),
    status: z.string().optional(),
    annotations: z.array(z.object({ type: z.string(), description: z.string().optional() })).default([]),
    results: z.array(PwResultSchema).default([]),
  })
  .loose()
const PwSpecSchema = z.object({ title: z.string(), tests: z.array(PwTestSchema).default([]) }).loose()
export type PwSuite = { title: string; specs: z.infer<typeof PwSpecSchema>[]; suites: PwSuite[] }
export const PwSuiteSchema: z.ZodType<PwSuite> = z.lazy(() =>
  z.object({ title: z.string(), specs: z.array(PwSpecSchema).default([]), suites: z.array(PwSuiteSchema).default([]) }),
)
export const PwReportSchema = z.object({ suites: z.array(PwSuiteSchema).default([]) }).loose()
