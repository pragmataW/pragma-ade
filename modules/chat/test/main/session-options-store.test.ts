import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SESSION_OPTIONS_MAX } from '../../src/constants'
import { SessionOptionsStore } from '../../src/main/session-options-store'
import { FAKE_OPTIONS } from '../../testing'

const dirs: string[] = []
const tempFile = () => {
  const dir = mkdtempSync(join(tmpdir(), 'chat-options-'))
  dirs.push(dir)
  return join(dir, 'nested', 'options.json')
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const saved = { options: FAKE_OPTIONS, chosen: { fakeMode: 'b' } }

describe('SessionOptionsStore', () => {
  it('survives a restart through its file', () => {
    const file = tempFile()
    new SessionOptionsStore(file).set('s1', saved)
    expect(new SessionOptionsStore(file).get('s1')).toEqual(saved)
  })

  it('a broken file starts empty and is replaced on the next write', () => {
    const file = tempFile()
    new SessionOptionsStore(file).set('s0', saved)
    writeFileSync(file, '{not json')
    const store = new SessionOptionsStore(file)
    expect(store.get('s0')).toBeUndefined()
    store.set('s1', saved)
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')).sessions)).toEqual(['s1'])
  })

  it("keeps each profile's latest options across a restart, apart from the session entries", () => {
    const file = tempFile()
    const store = new SessionOptionsStore(file)
    store.set('s1', saved)
    store.setLatest('p1', FAKE_OPTIONS)
    const again = new SessionOptionsStore(file)
    expect(again.latest('p1')).toEqual(FAKE_OPTIONS)
    expect(again.latest('p2')).toBeUndefined()
    expect(again.get('s1')).toEqual(saved)
    expect(again.get('p1')).toBeUndefined()
  })

  it('reads the earlier file format (sessions only)', () => {
    const file = tempFile()
    new SessionOptionsStore(file).set('s0', saved)
    writeFileSync(file, JSON.stringify({ s1: saved }))
    expect(new SessionOptionsStore(file).get('s1')).toEqual(saved)
  })

  it('keeps the most recently changed sessions only', () => {
    const store = new SessionOptionsStore()
    for (let i = 0; i <= SESSION_OPTIONS_MAX; i++) store.set(`s${i}`, saved)
    store.set('s1', saved)
    expect(store.get('s0')).toBeUndefined()
    expect(store.get('s1')).toEqual(saved)
    expect(store.get(`s${SESSION_OPTIONS_MAX}`)).toEqual(saved)
  })
})
