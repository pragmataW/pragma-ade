/** `@pragma/module-cli-integration/testing` (test code only). */
import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKILL_IDS, SKILL_INSTALL_NAMES, type SkillsCapability } from '../src/contract'

export * from './ask-provider'
export * from './fake-ask-bin'
export * from './run-cli'

export interface SkillsCase {
  name: string
  env: Record<string, string | undefined>
  /** Expected base dir (the skills live in `<base>/skills/<installed name>`), `<home>` replaced. */
  base: string
}

const HOME = '/home/u'
const HOME_TOKEN = '<home>'

/** Shared conformance suite every provider's `skills` capability passes. */
export function describeSkillsCapability(provider: string, cap: SkillsCapability, cases: SkillsCase[]): void {
  describe(`${provider} skills capability`, () => {
    it.each(cases)('$name', ({ env, base }) => {
      const root = base.replace(HOME_TOKEN, HOME)
      expect(cap.skillInstallTargets(HOME, env)).toEqual(
        SKILL_IDS.map((skillId) => ({ skillId, dir: `${root}/skills/${SKILL_INSTALL_NAMES[skillId]}` })),
      )
    })
    it.each(SKILL_IDS)('basename of the %s dir is its installed name', (skillId) => {
      const target = cap.skillInstallTargets(HOME, {}).find((t) => t.skillId === skillId)
      expect(target && basename(target.dir)).toBe(SKILL_INSTALL_NAMES[skillId])
    })
  })
}
