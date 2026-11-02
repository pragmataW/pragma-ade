import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { SKILL_FILE, SKILL_IDS, SKILL_INSTALL_NAMES, type SkillsCapability } from '../../src/contract'
import { planSkillTargets, type SkillProvider } from '../../src/main/skills-installer'

const SOURCE_SKILLS = join(import.meta.dirname, '..', '..', 'skills')
const roots: string[] = []
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true })
})

/** Inline fake capability: `<home>/.<id>/skills/<installed name>` (real provider capabilities live in other packages). */
const fakeSkills = (id: string): SkillsCapability => ({
  skillInstallTargets: (home) =>
    SKILL_IDS.map((skillId) => ({ skillId, dir: join(home, `.${id}`, 'skills', SKILL_INSTALL_NAMES[skillId]) })),
})

/** Temp HOME, a copy of the real skill sources, two fake providers and a registry path in a temp data dir. */
export function makeSkillsFixture() {
  const root = mkdtempSync(join(tmpdir(), 'pragma-skills-'))
  roots.push(root)
  const home = join(root, 'home')
  const skillsDir = join(root, 'skills')
  mkdirSync(home, { recursive: true })
  cpSync(SOURCE_SKILLS, skillsDir, { recursive: true })
  const providers: SkillProvider[] = ['alpha', 'beta'].map((id) => ({
    id,
    displayNameKey: `${id}:module.name`,
    skills: fakeSkills(id),
  }))
  return {
    root,
    home,
    skillsDir,
    providers,
    registryPath: join(root, 'data', 'installed-skills.json'),
    targets: () => planSkillTargets(providers, home, {}),
    editSource: (skillId: string, text: string) => writeFileSync(join(skillsDir, skillId, SKILL_FILE), text),
  }
}
