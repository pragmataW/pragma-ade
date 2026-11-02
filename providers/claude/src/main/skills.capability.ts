import { join } from 'node:path'
import { SKILL_IDS, SKILL_INSTALL_NAMES, type SkillsCapability } from '@pragma/module-cli-integration/contract'
import { defineCapability } from '@pragma/sdk'
import { PROVIDER_ID } from '../constants'

const SKILLS = 'skills'
const CONFIG_DIR = '.claude'

/** Claude Code discovers personal skills in `~/.claude/skills/<name>/SKILL.md` (OpenCode 2.x reads it too). */
export const skillsCapability: SkillsCapability = {
  skillInstallTargets: (home) =>
    SKILL_IDS.map((skillId) => ({ skillId, dir: join(home, CONFIG_DIR, SKILLS, SKILL_INSTALL_NAMES[skillId]) })),
}

export default defineCapability(PROVIDER_ID, SKILLS, skillsCapability)
