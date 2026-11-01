import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnFake } from '@pragma/module-agent-status/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { fakeClaudeHooksPath } from '../testing/fake-claude-hooks'

const dirs: string[] = []
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true })
})

describe('fake-claude-hooks', () => {
  it('runs Stop hooks from --settings with JSON stdin', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pragma-fake-claude-'))
    dirs.push(dir)
    const out = join(dir, 'out.jsonl')
    const settings = join(dir, 'settings.json')
    await writeFile(
      settings,
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: 'command', command: `cat >> '${out}'; echo >> '${out}'` }] }] },
      }),
    )
    const fake = spawnFake(fakeClaudeHooksPath, ['--settings', settings], { FAKE_CLAUDE_SESSION_ID: 'c-9' })
    await fake.waitForOutput('ready')
    fake.send('hook Stop')
    await fake.waitForOutput('hooked Stop')
    fake.send('exit')
    expect(await fake.exited).toBe(0)
    const [line] = (await readFile(out, 'utf8')).trim().split('\n')
    expect(JSON.parse(line as string)).toMatchObject({ hook_event_name: 'Stop', session_id: 'c-9' })
  })
})
