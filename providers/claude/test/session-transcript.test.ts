import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { claudeProjectDirName } from '../src/main/resume/conversation'
import { claudeSessionTranscriptCapability as cap } from '../src/main/sessionTranscript.capability'

const ID = '0b5e7c1a-2f3d-4e5f-8a9b-1c2d3e4f5a6b'

let temp = ''
let home = ''
let cwd = ''
beforeEach(() => {
  temp = realpathSync(mkdtempSync(join(tmpdir(), 'pragma-claude-transcript-')))
  home = join(temp, 'home')
  cwd = join(temp, 'repo')
  mkdirSync(cwd, { recursive: true })
})
afterEach(() => rmSync(temp, { recursive: true, force: true }))

function transcript(configDir: string, dir: string): string {
  const projectDir = join(configDir, 'projects', dir)
  mkdirSync(projectDir, { recursive: true })
  const path = join(projectDir, `${ID}.jsonl`)
  writeFileSync(path, `{"type":"summary"}\n{"type":"user","cwd":${JSON.stringify(cwd)}}\n`)
  return path
}

describe('claude sessionTranscript capability', () => {
  it('finds ~/.claude/projects/<cwd>/<id>.jsonl under the given home and reads cwd from the events', async () => {
    const path = transcript(join(home, '.claude'), claudeProjectDirName(cwd))
    expect(await cap.locateTranscript({ sessionId: ID, home, env: {} })).toEqual({
      path,
      format: expect.stringContaining('JSONL'),
      cwd,
      readCommand: null,
      extraPaths: [],
    })
  })

  it('honours CLAUDE_CONFIG_DIR and lists subagent transcripts', async () => {
    const config = join(temp, 'cfg')
    const path = transcript(config, 'other-dir')
    const subagents = join(config, 'projects', 'other-dir', ID, 'subagents')
    mkdirSync(subagents, { recursive: true })
    writeFileSync(join(subagents, 'agent-b.jsonl'), '{}\n')
    writeFileSync(join(subagents, 'agent-a.jsonl'), '{}\n')
    writeFileSync(join(subagents, 'notes.txt'), 'x')
    const found = await cap.locateTranscript({ sessionId: ID, cwd, home, env: { CLAUDE_CONFIG_DIR: config } })
    expect(found?.path).toBe(path)
    expect(found?.extraPaths).toEqual([join(subagents, 'agent-a.jsonl'), join(subagents, 'agent-b.jsonl')])
  })

  it('unknown or unsafe ids → null', async () => {
    transcript(join(home, '.claude'), claudeProjectDirName(cwd))
    expect(await cap.locateTranscript({ sessionId: 'nope', home, env: {} })).toBeNull()
    expect(await cap.locateTranscript({ sessionId: '../x', home, env: {} })).toBeNull()
  })
})
