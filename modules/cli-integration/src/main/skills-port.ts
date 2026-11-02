import { join } from 'node:path'
import type { MainContext } from '@pragma/sdk/main'
import { REGISTRY_FILE, SETTINGS_PAGE_ID } from '../constants'
import type { CliIntegrationSettings, SkillTargetStatus } from '../contract'
import type { CliPaths } from './paths'
import type { SkillsPort } from './service'
import {
  checkSkillUpdates,
  installSkills,
  type PlannedTarget,
  planSkillTargets,
  readSkillSources,
  type SkillProvider,
  skillTargetStatus,
  withSources,
} from './skills-installer'

type Ctx = MainContext<CliIntegrationSettings>
const SKILLS_CAPABILITY = 'skills'

function skillProviders(ctx: Ctx): SkillProvider[] {
  return ctx.providers.providersWith(SKILLS_CAPABILITY).flatMap((d) => {
    const skills = ctx.providers.capability(d.id, SKILLS_CAPABILITY)
    return skills ? [{ id: d.id, displayNameKey: d.displayNameKey, skills }] : []
  })
}

/** Skills behind the settings IPC: providers' `skills` capabilities × the bundled `skills/` sources. */
export function createSkillsPort(
  ctx: Ctx,
  paths: CliPaths,
): SkillsPort & { checkForUpdates(home: string): Promise<void> } {
  const registryPath = join(ctx.module.paths.data, REGISTRY_FILE)
  const plan = async (home: string) => {
    const sources = await readSkillSources(paths.skillsDir)
    const skip = (t: PlannedTarget) => ctx.log.warn(`cli-integration: no source for skill ${t.skillId} (${t.dir})`)
    return { sources, targets: withSources(planSkillTargets(skillProviders(ctx), home, process.env), sources, skip) }
  }
  const statuses = async (home: string): Promise<SkillTargetStatus[]> => {
    const { sources, targets } = await plan(home)
    return Promise.all(targets.map((t) => skillTargetStatus(t, sources, registryPath)))
  }
  return {
    statuses,
    async install(home, providerIds) {
      const { sources, targets } = await plan(home)
      const chosen = targets.filter((t) => providerIds.includes(t.providerId))
      await installSkills(chosen, sources, ctx.module.version, registryPath)
    },
    async checkForUpdates(home) {
      const { sources } = await plan(home)
      checkSkillUpdates({
        statuses: await statuses(home),
        sources,
        promptedHash: ctx.settings.get().skillUpdatePromptedHash,
        settingsPageId: SETTINGS_PAGE_ID,
        notify: (n) => ctx.notifications.show(n),
        savePromptedHash: (hash) => ctx.settings.update({ skillUpdatePromptedHash: hash }),
      })
    },
  }
}
