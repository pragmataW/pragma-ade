import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { claudeConfigDir, claudeProjectDirName, hasClaudeConversation } from '../src/main/resume/conversation'
import { claudeResumeCapability as cap } from '../src/main/resume.capability'

const ID = '88f976ca-736c-4d22-8d69-a298d1c792dc'

let temp = ''
let worktree = ''
let config = ''
beforeEach(() => {
  temp = realpathSync(mkdtempSync(join(tmpdir(), 'pragma-claude-conv-')))
  worktree = join(temp, 'worktrees', 'feat-tas-4.task5')
  config = join(temp, 'cfg')
  mkdirSync(worktree, { recursive: true })
})
afterEach(() => rmSync(temp, { recursive: true, force: true }))

/** Writes `<config>/projects/<dir>/<id>.jsonl` like the CLI does after the first message. */
function transcript(dir: string, content = '{"type":"user"}\n', id = ID) {
  mkdirSync(join(config, 'projects', dir), { recursive: true })
  writeFileSync(join(config, 'projects', dir, `${id}.jsonl`), content)
}
const query = (env: Record<string, string> = { CLAUDE_CONFIG_DIR: config }, worktreePath = worktree) => ({
  externalSessionId: ID,
  worktreePath,
  env,
})

describe('claude conversation lookup (hasConversation)', () => {
  it('project dir = cwd with every non-alphanumeric char as "-" (as the CLI names it)', () => {
    expect(claudeProjectDirName('/Users/me/pragma/worktrees/tasarruf/feat-tas-4.task5')).toBe(
      '-Users-me-pragma-worktrees-tasarruf-feat-tas-4-task5',
    )
  })

  it('config dir: CLAUDE_CONFIG_DIR, else HOME/.claude', () => {
    expect(claudeConfigDir({ CLAUDE_CONFIG_DIR: '/c', HOME: '/h' })).toBe('/c')
    expect(claudeConfigDir({ HOME: '/h' })).toBe(join('/h', '.claude'))
  })

  it('no transcript yet (no message sent) → false', async () => {
    expect(await hasClaudeConversation(query())).toBe(false)
    expect(await cap.hasConversation?.(query())).toBe(false)
  })

  it("the worktree's own project dir → true", async () => {
    transcript(claudeProjectDirName(worktree))
    expect(await hasClaudeConversation(query())).toBe(true)
  })

  it('an empty file does not count', async () => {
    transcript(claudeProjectDirName(worktree), '')
    expect(await hasClaudeConversation(query())).toBe(false)
  })

  it('another id in the same dir does not count', async () => {
    transcript(claudeProjectDirName(worktree), '{}\n', '73a33256-8e68-4e9c-85ee-561471e98035')
    expect(await hasClaudeConversation(query())).toBe(false)
  })

  it('respects the config dir of the launch env (HOME/.claude without CLAUDE_CONFIG_DIR)', async () => {
    transcript(claudeProjectDirName(worktree))
    expect(await hasClaudeConversation(query({ HOME: temp }))).toBe(false)
    config = join(temp, '.claude')
    transcript(claudeProjectDirName(worktree))
    expect(await hasClaudeConversation(query({ HOME: temp }))).toBe(true)
  })

  it('a symlinked worktree path is resolved', async () => {
    const link = join(temp, 'link')
    symlinkSync(worktree, link)
    transcript(claudeProjectDirName(worktree))
    expect(await hasClaudeConversation(query(undefined, link))).toBe(true)
  })

  it('falls back to any project dir (the CLI shortens very long cwds)', async () => {
    transcript('-shortened-name-1a2b3c')
    expect(await hasClaudeConversation(query())).toBe(true)
  })

  it.each(['../x', '-p', ''])('an unsafe id %j → false (never a path)', async (externalSessionId) => {
    expect(await hasClaudeConversation({ ...query(), externalSessionId })).toBe(false)
  })
})
