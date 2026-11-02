import { homedir, userInfo } from 'node:os'
import { TEST_MODE_ENABLED, TEST_MODE_ENV } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { WIN32 } from '../constants'
import { type CliIntegrationSettings, type CliIntegrationStatus, cliIntegrationIpc, type SkillTargetStatus } from '../contract'
import { type CliInstallDeps, cliInstallStatus, defaultInstallDir, installCli, uninstallCli, windowsUserPath } from './install-cli'
import type { CliPaths } from './paths'
import { assertSafeHome } from './safe-home'

type Ctx = MainContext<CliIntegrationSettings>

export interface SkillsPort {
  statuses(home: string): Promise<SkillTargetStatus[]>
  install(home: string, providerIds: string[]): Promise<void>
}

/** Settings › Command line behind IPC: status, PATH install/uninstall, skill install; publishes `statusChanged`. */
export function createCliIntegrationService(ctx: Ctx, paths: CliPaths, skills: SkillsPort) {
  const home = (): string => {
    const h = homedir()
    assertSafeHome(h, { isTest: process.env[TEST_MODE_ENV] === TEST_MODE_ENABLED, realHome: userInfo().homedir })
    return h
  }
  const deps = (h: string): CliInstallDeps => ({
    platform: process.platform,
    home: h,
    paths,
    shellPath: async () => (await ctx.env.getShellEnv()).PATH,
    userPath: process.platform === WIN32 ? windowsUserPath() : { get: async () => '', set: async () => undefined },
  })
  const dirOf = (h: string): string => ctx.settings.get().installDir ?? defaultInstallDir(process.platform, h, paths.binDir)
  const status = async (h = homedir()): Promise<CliIntegrationStatus> => ({
    cli: await cliInstallStatus(dirOf(h), deps(h)),
    skills: await skills.statuses(h),
  })
  const changed = async (h: string): Promise<CliIntegrationStatus> => {
    const s = await status(h)
    ctx.ipc.publish(cliIntegrationIpc.statusChanged, s)
    return s
  }
  return {
    getStatus: () => status(),
    async installCli(dir?: string) {
      const h = home()
      if (dir) ctx.settings.update({ installDir: dir })
      await installCli(dirOf(h), deps(h))
      return changed(h)
    },
    async uninstallCli() {
      const h = home()
      await uninstallCli(dirOf(h), deps(h))
      return changed(h)
    },
    async installSkills(providerIds: string[]) {
      const h = home()
      await skills.install(h, providerIds)
      return changed(h)
    },
  }
}

export type CliIntegrationService = ReturnType<typeof createCliIntegrationService>

export function registerCliIntegrationIpc(ctx: Ctx, service: CliIntegrationService): void {
  ctx.ipc.handle(cliIntegrationIpc.getStatus, () => service.getStatus())
  ctx.ipc.handle(cliIntegrationIpc.installCli, ({ dir }) => service.installCli(dir))
  ctx.ipc.handle(cliIntegrationIpc.uninstallCli, () => service.uninstallCli())
  ctx.ipc.handle(cliIntegrationIpc.installSkills, ({ providerIds }) => service.installSkills(providerIds))
}
