import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { opencodeSessionTranscriptCapability as cap, opencodeDbPath } from '../src/main/sessionTranscript.capability'

const V2_ID = 'ses_243bb3210ffemQttpEg5Uphr7t'
const V1_ID = 'ses_ed33a100dffezbG03YjR882BvR'

let temp = ''
let home = ''
beforeEach(() => {
  temp = realpathSync(mkdtempSync(join(tmpdir(), 'pragma-opencode-transcript-')))
  home = join(temp, 'home')
})
afterEach(() => rmSync(temp, { recursive: true, force: true }))

/** A minimal opencode.db: the two session tables with the columns we read. */
function seedDb(path: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('CREATE TABLE session_v2 (id TEXT PRIMARY KEY, directory TEXT NOT NULL)')
  db.exec('CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT NOT NULL)')
  db.prepare('INSERT INTO session_v2 VALUES (?, ?)').run(V2_ID, '/work/repo')
  db.prepare('INSERT INTO session VALUES (?, ?)').run(V1_ID, '/work/old')
  db.close()
}

describe('opencode sessionTranscript capability', () => {
  it('db path: OPENCODE_DB (absolute), else XDG_DATA_HOME/opencode, else ~/.local/share/opencode', () => {
    expect(opencodeDbPath('/h', { OPENCODE_DB: '/x/o.db' })).toBe('/x/o.db')
    expect(opencodeDbPath('/h', { OPENCODE_DB: ':memory:', XDG_DATA_HOME: '/d' })).toBe(
      join('/d', 'opencode', 'opencode.db'),
    )
    expect(opencodeDbPath('/h', {})).toBe(join('/h', '.local', 'share', 'opencode', 'opencode.db'))
  })

  it('finds v2 and pre-v2 sessions with their directory and an export command', async () => {
    const db = join(home, '.local', 'share', 'opencode', 'opencode.db')
    seedDb(db)
    expect(await cap.locateTranscript({ sessionId: V2_ID, home, env: {} })).toEqual({
      path: db,
      format: expect.stringContaining('SQLite'),
      cwd: '/work/repo',
      readCommand: `opencode session export ${V2_ID}`,
      extraPaths: [],
    })
    expect((await cap.locateTranscript({ sessionId: V1_ID, home, env: {} }))?.cwd).toBe('/work/old')
  })

  it('honours XDG_DATA_HOME; unknown ids, non-opencode ids and a missing db → null', async () => {
    const data = join(temp, 'xdg')
    seedDb(join(data, 'opencode', 'opencode.db'))
    const env = { XDG_DATA_HOME: data }
    expect((await cap.locateTranscript({ sessionId: V2_ID, home, env }))?.cwd).toBe('/work/repo')
    expect(await cap.locateTranscript({ sessionId: 'ses_unknown', home, env })).toBeNull()
    expect(await cap.locateTranscript({ sessionId: '0b5e7c1a-2f3d', home, env })).toBeNull()
    expect(await cap.locateTranscript({ sessionId: V2_ID, home, env: {} })).toBeNull()
  })
})
