import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'

export const cliIntegrationSettingsSchema = z.object({
  /** Where "Add pragma to PATH" puts the link; null = the platform default. */
  installDir: z.string().nullable(),
  /** `combinedSourceHash` of the skills the user was last told about (one prompt per skill version). */
  skillUpdatePromptedHash: z.string().nullable(),
})
export type CliIntegrationSettings = z.infer<typeof cliIntegrationSettingsSchema>
export const CLI_INTEGRATION_SETTINGS_DEFAULTS: CliIntegrationSettings = {
  installDir: null,
  skillUpdatePromptedHash: null,
}

export const CLI_INSTALL_STATES = ['not_installed', 'installed', 'conflict'] as const
export type CliInstallState = (typeof CLI_INSTALL_STATES)[number]
export const CLI_INSTALL_STATE = Object.fromEntries(CLI_INSTALL_STATES.map((s) => [s, s])) as {
  readonly [K in CliInstallState]: K
}
export const SKILL_STATES = ['missing', 'current', 'outdated', 'foreign'] as const
export type SkillState = (typeof SKILL_STATES)[number]
export const SKILL_STATE = Object.fromEntries(SKILL_STATES.map((s) => [s, s])) as { readonly [K in SkillState]: K }

export const cliInstallStatusSchema = z.object({
  shimPath: z.string(),
  bundleFound: z.boolean(),
  installDir: z.string(),
  linkPath: z.string(),
  state: z.enum(CLI_INSTALL_STATES),
  /** null when the login-shell PATH is unknown. */
  dirOnPath: z.boolean().nullable(),
})
export type CliInstallStatus = z.infer<typeof cliInstallStatusSchema>
export const skillTargetStatusSchema = z.object({
  providerId: z.string(),
  providerDisplayNameKey: z.string(),
  skillId: z.string(),
  dir: z.string(),
  state: z.enum(SKILL_STATES),
})
export type SkillTargetStatus = z.infer<typeof skillTargetStatusSchema>
export const cliIntegrationStatusSchema = z.object({
  cli: cliInstallStatusSchema,
  skills: z.array(skillTargetStatusSchema),
})
export type CliIntegrationStatus = z.infer<typeof cliIntegrationStatusSchema>

export const CLI_IPC = {
  getStatus: 'cli-integration.getStatus',
  installCli: 'cli-integration.installCli',
  uninstallCli: 'cli-integration.uninstallCli',
  installSkills: 'cli-integration.installSkills',
  statusChanged: 'cli-integration.statusChanged',
} as const

export const cliIntegrationIpc = {
  getStatus: defineIpc({ channel: CLI_IPC.getStatus, input: z.void(), output: cliIntegrationStatusSchema }),
  installCli: defineIpc({
    channel: CLI_IPC.installCli,
    input: z.object({ dir: z.string().trim().min(1).optional() }),
    output: cliIntegrationStatusSchema,
  }),
  uninstallCli: defineIpc({ channel: CLI_IPC.uninstallCli, input: z.void(), output: cliIntegrationStatusSchema }),
  installSkills: defineIpc({
    channel: CLI_IPC.installSkills,
    input: z.object({ providerIds: z.array(z.string().min(1)) }),
    output: cliIntegrationStatusSchema,
  }),
  statusChanged: defineIpcEvent({ channel: CLI_IPC.statusChanged, payload: cliIntegrationStatusSchema }),
} as const
