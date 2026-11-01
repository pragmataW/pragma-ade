import { expect, it } from 'vitest'
import { BROWSER_TEST_IDS, BrowserPickSchema, BrowserSnapshotSchema } from '../../src/contract'
import { buildPick, buildSnapshot } from '../lib/builders'

it('parses a built snapshot', () => expect(BrowserSnapshotSchema.parse(buildSnapshot())).toEqual(buildSnapshot()))

it('rejects a pick with a NaN rect', () => {
  const pick = buildPick({ rect: { x: Number.NaN, y: 0, width: 1, height: 1 } })
  expect(BrowserPickSchema.safeParse(pick).success).toBe(false)
})

it('test ids are prefixed and unique', () => {
  const values = Object.values(BROWSER_TEST_IDS)
  for (const v of values) expect(v).toMatch(/^browser-/)
  expect(new Set(values).size).toBe(values.length)
})
