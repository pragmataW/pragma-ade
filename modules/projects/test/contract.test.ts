import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PROJECTS_CHANNELS,
  PROJECTS_COMMANDS,
  PROJECTS_EVENTS,
  PROJECTS_SLOTS,
  PROJECTS_TESTIDS,
  ProjectsError,
  ProjectsSettingsSchema,
  projectsIpc,
  projectsIpcEvents,
  toErrorDto,
  WorktreeChangedPayloadSchema,
  WorktreeSchema,
} from '../src/contract'

const CONTRACT_DIR = join(import.meta.dirname, '..', 'src', 'contract')
const channels = Object.values(PROJECTS_CHANNELS) as string[]

describe('projects contract', () => {
  it('events are exactly the binding names', () => {
    expect(Object.values(PROJECTS_EVENTS).sort()).toEqual(
      ['project.removed', 'worktree.changed', 'worktree.created', 'worktree.removed', 'worktree.selected'].sort(),
    )
  })

  it.each(channels)('channel %s is projects.<action>', (c) => expect(c).toMatch(/^projects\.[a-zA-Z]+$/))

  it('channels are unique and every IPC contract uses one', () => {
    expect(new Set(channels).size).toBe(channels.length)
    for (const c of [...Object.values(projectsIpc), ...Object.values(projectsIpcEvents)])
      expect(channels).toContain(c.channel)
  })

  it('binding slot and command ids', () => {
    expect(PROJECTS_SLOTS.worktreeRowBadges).toBe('sidebar.worktreeRow.badges')
    expect(PROJECTS_COMMANDS.selectWorktree).toBe('projects.selectWorktree')
  })

  it.each([
    [{ worktreesRoot: '~/x' }, true],
    [{ worktreesRoot: '/abs' }, true],
    [{ worktreesRoot: 'rel/x' }, false],
    [{ worktreesRoot: '' }, false],
    [{}, false],
  ])('settings %j valid=%s', (value, valid) => expect(ProjectsSettingsSchema.safeParse(value).success).toBe(valid))

  it('worktree branch may be null; worktree.changed rejects unknown reasons', () => {
    const w = { id: 'w', projectId: 'p', path: '/p', branch: null, baseBranch: 'main', isMain: true, createdAt: 1 }
    expect(WorktreeSchema.safeParse({ ...w, archivedAt: null }).success).toBe(true)
    const changed = { worktreeId: 'w', path: '/p', changedPaths: [], truncated: false }
    expect(WorktreeChangedPayloadSchema.safeParse({ ...changed, reason: 'files' }).success).toBe(true)
    expect(WorktreeChangedPayloadSchema.safeParse({ ...changed, reason: 'other' }).success).toBe(false)
  })

  it.each([
    [new ProjectsError('alreadyAdded'), { code: 'alreadyAdded' }],
    [new ProjectsError('gitFailed', 'fatal'), { code: 'gitFailed', detail: 'fatal' }],
    [new Error('boom'), { code: 'gitFailed', detail: 'boom' }],
  ])('toErrorDto(%s)', (error, dto) => expect(toErrorDto(error)).toEqual(dto))

  it('test ids are unique and prefixed', () => {
    const ids = Object.values(PROJECTS_TESTIDS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.startsWith('projects-')).toBe(true)
  })

  it('contract files import neither node builtins nor electron', () => {
    for (const file of readdirSync(CONTRACT_DIR)) {
      const text = readFileSync(join(CONTRACT_DIR, file), 'utf8')
      expect(text).not.toMatch(/from 'node:/)
      expect(text).not.toMatch(/from 'electron'/)
    }
  })
})
