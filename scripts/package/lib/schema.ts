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
