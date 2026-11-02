import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { CoreCommands, type NotificationInput, z } from '@pragma/sdk'
import { readJsonFile, writeFileAtomic } from '@pragma/sdk/main'
import { SKILL_FILE, SKILL_STATE, type SkillState, type SkillsCapability, type SkillTargetStatus } from '../contract'

const HASH_ALGORITHM = 'sha256'
const HEX = 'hex'
const UTF8 = 'utf8'
const JSON_INDENT = 2

export interface SkillSource {
  skillId: string
  content: string
  /** sha256 hex of `SKILL.md`. */
  hash: string
}

export interface SkillProvider {
  id: string
  displayNameKey: string
  skills: SkillsCapability
}

export interface PlannedTarget {
  providerId: string
  providerDisplayNameKey: string
  skillId: string
  dir: string
}

/** Install registry (`<module data>/installed-skills.json`), keyed by absolute skill dir. Never inside skill dirs. */
const skillRegistrySchema = z.record(
  z.string(),
  z.object({ skillId: z.string(), hash: z.string(), appVersion: z.string(), installedAt: z.string() }),
)
type SkillRegistry = z.infer<typeof skillRegistrySchema>

const sha256 = (text: string): string => createHash(HASH_ALGORITHM).update(text).digest(HEX)

async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, UTF8)
  } catch {
    return null
  }
}

function readRegistry(path: string): SkillRegistry {
  const r = readJsonFile(path, skillRegistrySchema)
  return r.ok ? r.value : {}
}

/** Every `<skillsDir>/<skillId>/SKILL.md`, sorted by skill id. */
export async function readSkillSources(skillsDir: string): Promise<SkillSource[]> {
  const entries = await readdir(skillsDir, { withFileTypes: true })
  const ids = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  const sources: SkillSource[] = []
  for (const skillId of ids.sort()) {
    const content = await readText(join(skillsDir, skillId, SKILL_FILE))
    if (content !== null) sources.push({ skillId, content, hash: sha256(content) })
  }
  return sources
}

export function planSkillTargets(
  providers: SkillProvider[],
  home: string,
  env: Readonly<Record<string, string | undefined>>,
): PlannedTarget[] {
  return providers.flatMap((p) =>
    p.skills
      .skillInstallTargets(home, env)
      .map((t) => ({ providerId: p.id, providerDisplayNameKey: p.displayNameKey, skillId: t.skillId, dir: t.dir })),
  )
}

function stateOf(onDisk: string | null, entry: SkillRegistry[string] | undefined, source: SkillSource): SkillState {
  if (onDisk === null) return SKILL_STATE.missing
  if (!entry) return SKILL_STATE.foreign
  return entry.hash === source.hash && sha256(onDisk) === entry.hash ? SKILL_STATE.current : SKILL_STATE.outdated
}

/** missing (no SKILL.md) → foreign (not in our registry) → current (registry, source and disk agree) → outdated. */
export async function skillTargetStatus(
  t: PlannedTarget,
  sources: SkillSource[],
  registryPath: string,
): Promise<SkillTargetStatus> {
  const source = sources.find((s) => s.skillId === t.skillId)
  if (!source) throw new Error(`no source for skill ${t.skillId}`)
  const onDisk = await readText(join(t.dir, SKILL_FILE))
  return { ...t, state: stateOf(onDisk, readRegistry(registryPath)[t.dir], source) }
}

/** Targets whose skill has a source; the others are reported through `skip`. */
export function withSources(targets: PlannedTarget[], sources: SkillSource[], skip: (t: PlannedTarget) => void) {
  return targets.filter((t) => {
    const known = sources.some((s) => s.skillId === t.skillId)
    if (!known) skip(t)
    return known
  })
}

/** Writes only `SKILL.md` into each target dir, then records it in the registry. Overwrites foreign targets. */
export async function installSkills(
  targets: PlannedTarget[],
  sources: SkillSource[],
  appVersion: string,
  registryPath: string,
  now: () => Date = () => new Date(),
): Promise<void> {
  const registry = readRegistry(registryPath)
  for (const t of targets) {
    const source = sources.find((s) => s.skillId === t.skillId)
    if (!source) continue
    writeFileAtomic(join(t.dir, SKILL_FILE), source.content)
    registry[t.dir] = { skillId: t.skillId, hash: source.hash, appVersion, installedAt: now().toISOString() }
  }
  writeFileAtomic(registryPath, `${JSON.stringify(registry, null, JSON_INDENT)}\n`)
}

export function combinedSourceHash(sources: SkillSource[]): string {
  const parts = sources.map((s) => `${s.skillId}:${s.hash}`).sort()
  return sha256(parts.join('\n'))
}

/** One notification per source version when an installed skill is outdated; `missing` never prompts (opt-in). */
export function checkSkillUpdates(o: {
  statuses: SkillTargetStatus[]
  sources: SkillSource[]
  promptedHash: string | null
  settingsPageId: string
  notify: (n: NotificationInput) => void
  savePromptedHash: (hash: string) => void
}): void {
  if (!o.statuses.some((s) => s.state === SKILL_STATE.outdated)) return
  const hash = combinedSourceHash(o.sources)
  if (hash === o.promptedHash) return
  o.notify({
    titleKey: 'cli-integration:notifications.skillsOutdated.title',
    bodyKey: 'cli-integration:notifications.skillsOutdated.body',
    onClickCommand: { id: CoreCommands.openSettings, args: { pageId: o.settingsPageId } },
  })
  o.savePromptedHash(hash)
}
