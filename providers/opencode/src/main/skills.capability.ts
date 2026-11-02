import { join } from 'node:path'
import { SKILL_IDS, SKILL_INSTALL_NAMES, type SkillsCapability } from '@pragma/module-cli-integration/contract'
import { defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'

const SKILLS = 'skills'
const ENV = { configDir: 'OPENCODE_CONFIG_DIR', xdgConfig: 'XDG_CONFIG_HOME' } as const
const APP_DIR = 'opencode'
const DOT_CONFIG = '.config'

/** OpenCode 2.x global config dir: `$OPENCODE_CONFIG_DIR`, else `$XDG_CONFIG_HOME/opencode`, else `~/.config/opencode`. */
function configDir(home: string, env: Readonly<Record<string, string | undefined>>): string {
  const explicit = env[ENV.configDir]
  if (explicit) return explicit
  return join(env[ENV.xdgConfig] || join(home, DOT_CONFIG), APP_DIR)
}

/** OpenCode 2.x scans `<configDir>/skills/<name>/SKILL.md`. */
export const skillsCapability: SkillsCapability = {
  skillInstallTargets: (home, env = {}) =>
    SKILL_IDS.map((skillId) => ({ skillId, dir: join(configDir(home, env), SKILLS, SKILL_INSTALL_NAMES[skillId]) })),
}

export default defineCapability(PROVIDER_ID, SKILLS, skillsCapability)
