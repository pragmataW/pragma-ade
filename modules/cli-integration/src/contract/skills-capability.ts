/** One skill directory a provider's CLI discovers (`<dir>/SKILL.md`). */
export interface SkillInstallTarget {
  skillId: string
  dir: string
}

/** Provider capability `skills` (§5.2): where this provider's CLI looks for agent skills. */
export interface SkillsCapability {
  /** Absolute dirs (one per skill) where this provider's CLI discovers skills. */
  skillInstallTargets(home: string, env?: Readonly<Record<string, string | undefined>>): SkillInstallTarget[]
}

declare module '@pragma/sdk' {
  interface CapabilityMap {
    skills: SkillsCapability
  }
}
