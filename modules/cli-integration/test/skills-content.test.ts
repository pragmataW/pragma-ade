import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKILL_FILE, SKILL_IDS, SKILL_INSTALL_NAMES } from '../src/contract'
import { parseFrontmatter } from './support/frontmatter'

const SKILLS_DIR = join(import.meta.dirname, '..', 'skills')
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DESCRIPTION_MAX = 1024
const read = (id: string) => parseFrontmatter(readFileSync(join(SKILLS_DIR, id, SKILL_FILE), 'utf8'))

describe('skills', () => {
  it('every source folder is a known skill with only SKILL.md inside', () => {
    expect(readdirSync(SKILLS_DIR).sort()).toEqual([...SKILL_IDS].sort())
    for (const id of SKILL_IDS) expect(readdirSync(join(SKILLS_DIR, id))).toEqual([SKILL_FILE])
  })

  it.each(SKILL_IDS)('%s frontmatter is valid', (id) => {
    const { data } = read(id)
    expect(data.name).toBe(SKILL_INSTALL_NAMES[id])
    expect(data.name).toMatch(NAME_RE)
    expect(data.description?.length).toBeGreaterThan(0)
    expect(data.description?.length).toBeLessThanOrEqual(DESCRIPTION_MAX)
  })

  it.each([
    '## Goal',
    '## Done so far',
    '## Remaining work',
    '## Relevant files',
    '## Open questions',
    '## How to verify',
    '## Branch and worktree',
    'pragma handoff --to',
  ])('handoff body contains %s', (text) => {
    expect(read('handoff').body).toContain(text)
  })

  it.each(['pragma task columns', 'pragma task show', 'pragma task list --column', 'pragma task move', 'ask the user'])(
    'board body contains %s',
    (text) => {
      expect(read('board').body).toContain(text)
    },
  )

  it.each(['pragma ask --to', 'pragma agent profiles', '--prompt-file', 'blocks', 'NEVER', 'explicitly'])(
    'ask body contains %s',
    (text) => {
      expect(read('ask').body).toContain(text)
    },
  )

  it.each(["opencode'a sor", "codex'e danış", 'NEVER', 'pragma-handoff'])('ask description mentions %s', (text) => {
    expect(read('ask').data.description).toContain(text)
  })

  it('handoff and pragma-cli point at pragma-ask', () => {
    expect(read('handoff').data.description).toContain('pragma-ask')
    expect(read('handoff').body).toContain('pragma-ask')
    expect(read('pragma-cli').data.description).toContain('pragma-ask')
  })

  it.each([
    'worktree',
    'agent',
    'task',
    'task columns',
    'task show',
    'comments',
    'handoff',
    'session locate',
    'session current',
    'ask',
  ])('pragma-cli mentions `pragma %s`', (cmd) => {
    expect(read('pragma-cli').body).toContain(`pragma ${cmd}`)
  })
})
