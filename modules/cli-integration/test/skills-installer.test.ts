import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CoreCommands } from '@pragma/sdk'
import { describe, expect, it } from 'vitest'
import { SKILL_FILE, SKILL_STATE } from '../src/contract'
import {
  checkSkillUpdates,
  combinedSourceHash,
  installSkills,
  planSkillTargets,
  readSkillSources,
  skillTargetStatus,
} from '../src/main/skills-installer'
import { makeSkillsFixture } from './support/skills'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

describe('skills installer', () => {
  it('reads both sources with sha256', async () => {
    const f = makeSkillsFixture()
    const sources = await readSkillSources(f.skillsDir)
    expect(sources.map((s) => s.skillId)).toEqual(['handoff', 'pragma-cli'])
    for (const s of sources) expect(s.hash).toBe(sha(s.content))
  })

  it('plans targets per provider', () => {
    const f = makeSkillsFixture()
    const targets = planSkillTargets(f.providers, f.home, {})
    expect(targets.map((t) => [t.providerId, t.skillId, t.dir])).toEqual([
      ['alpha', 'handoff', join(f.home, '.alpha', 'skills', 'pragma-handoff')],
      ['alpha', 'pragma-cli', join(f.home, '.alpha', 'skills', 'pragma-cli')],
      ['beta', 'handoff', join(f.home, '.beta', 'skills', 'pragma-handoff')],
      ['beta', 'pragma-cli', join(f.home, '.beta', 'skills', 'pragma-cli')],
    ])
    expect(targets[0]?.providerDisplayNameKey).toBe('alpha:module.name')
  })

  it('missing → installs → current', async () => {
    const f = makeSkillsFixture()
    const sources = await readSkillSources(f.skillsDir)
    const [target] = f.targets()
    if (!target) throw new Error('no target')
    expect(await skillTargetStatus(target, sources, f.registryPath)).toMatchObject({ state: SKILL_STATE.missing })
    await installSkills([target], sources, '1.0.0', f.registryPath)
    expect(await skillTargetStatus(target, sources, f.registryPath)).toMatchObject({ state: SKILL_STATE.current })
    expect(readFileSync(join(target.dir, SKILL_FILE), 'utf8')).toBe(sources[0]?.content)
  })

  it('source changed → outdated', async () => {
    const f = makeSkillsFixture()
    const targets = f.targets()
    await installSkills(targets, await readSkillSources(f.skillsDir), '1.0.0', f.registryPath)
    f.editSource('handoff', 'changed')
    const sources = await readSkillSources(f.skillsDir)
    const states = await Promise.all(targets.map((t) => skillTargetStatus(t, sources, f.registryPath)))
    expect(states.map((s) => [s.skillId, s.state])).toEqual([
      ['handoff', 'outdated'],
      ['pragma-cli', 'current'],
      ['handoff', 'outdated'],
      ['pragma-cli', 'current'],
    ])
  })

  it('SKILL.md without registry entry → foreign', async () => {
    const f = makeSkillsFixture()
    const [target] = f.targets()
    if (!target) throw new Error('no target')
    mkdirSync(target.dir, { recursive: true })
    writeFileSync(join(target.dir, SKILL_FILE), 'someone else')
    const status = await skillTargetStatus(target, await readSkillSources(f.skillsDir), f.registryPath)
    expect(status.state).toBe(SKILL_STATE.foreign)
  })

  it('hand-edited installed SKILL.md → outdated', async () => {
    const f = makeSkillsFixture()
    const sources = await readSkillSources(f.skillsDir)
    const [target] = f.targets()
    if (!target) throw new Error('no target')
    await installSkills([target], sources, '1.0.0', f.registryPath)
    writeFileSync(join(target.dir, SKILL_FILE), 'hand edit')
    expect((await skillTargetStatus(target, sources, f.registryPath)).state).toBe(SKILL_STATE.outdated)
  })

  it('install writes no file other than SKILL.md into the skill dir', async () => {
    const f = makeSkillsFixture()
    const targets = f.targets()
    await installSkills(targets, await readSkillSources(f.skillsDir), '1.0.0', f.registryPath)
    for (const t of targets) expect(readdirSync(t.dir)).toEqual([SKILL_FILE])
    expect(existsSync(f.registryPath)).toBe(true)
  })

  it('install only touches the given targets', async () => {
    const f = makeSkillsFixture()
    const alpha = f.targets().filter((t) => t.providerId === 'alpha')
    await installSkills(alpha, await readSkillSources(f.skillsDir), '1.0.0', f.registryPath)
    expect(existsSync(join(f.home, '.alpha'))).toBe(true)
    expect(existsSync(join(f.home, '.beta'))).toBe(false)
  })

  it('combinedSourceHash stable across order', async () => {
    const sources = await readSkillSources(makeSkillsFixture().skillsDir)
    expect(combinedSourceHash([...sources].reverse())).toBe(combinedSourceHash(sources))
  })

  it('startup prompt fires once per hash', async () => {
    const f = makeSkillsFixture()
    const targets = f.targets()
    await installSkills(targets, await readSkillSources(f.skillsDir), '1.0.0', f.registryPath)
    f.editSource('pragma-cli', 'v2')
    const shown: unknown[] = []
    let prompted: string | null = null
    const run = async () => {
      const sources = await readSkillSources(f.skillsDir)
      const statuses = await Promise.all(targets.map((t) => skillTargetStatus(t, sources, f.registryPath)))
      checkSkillUpdates({
        statuses,
        sources,
        promptedHash: prompted,
        notify: (n) => shown.push(n),
        savePromptedHash: (h) => {
          prompted = h
        },
        settingsPageId: 'cli-integration',
      })
    }
    await run()
    await run()
    expect(shown).toEqual([
      {
        titleKey: 'cli-integration:notifications.skillsOutdated.title',
        bodyKey: 'cli-integration:notifications.skillsOutdated.body',
        onClickCommand: { id: CoreCommands.openSettings, args: { pageId: 'cli-integration' } },
      },
    ])
    f.editSource('pragma-cli', 'v3')
    await run()
    expect(shown).toHaveLength(2)
  })

  it('missing targets never prompt', async () => {
    const f = makeSkillsFixture()
    const sources = await readSkillSources(f.skillsDir)
    const statuses = await Promise.all(f.targets().map((t) => skillTargetStatus(t, sources, f.registryPath)))
    const notify = (n: unknown) => {
      throw new Error(`unexpected ${JSON.stringify(n)}`)
    }
    checkSkillUpdates({ statuses, sources, promptedHash: null, notify, savePromptedHash: notify, settingsPageId: 'x' })
  })
})
