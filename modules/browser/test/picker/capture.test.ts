import { mkdtempSync, readdirSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { captureElement, clampCaptureRect, sweepShots } from '../../src/main/picker/capture'
import { fakeGuest, fakeImage } from '../lib/builders'

const VIEW = { width: 400, height: 300 }

it.each([
  ['inside', { x: 10, y: 20, width: 30, height: 40 }, { x: 10, y: 20, width: 30, height: 40 }],
  [
    'fractional (rounded outward)',
    { x: 10.4, y: 20.6, width: 30.2, height: 4 },
    { x: 10, y: 20, width: 31, height: 5 },
  ],
  ['partly off-screen', { x: -20, y: 280, width: 50, height: 100 }, { x: 0, y: 280, width: 30, height: 20 }],
  ['fully off-screen', { x: 500, y: 10, width: 50, height: 50 }, null],
  ['zero-size', { x: 10, y: 10, width: 0, height: 20 }, null],
])('clampCaptureRect %s', (_, rect, expected) => expect(clampCaptureRect(rect, VIEW)).toEqual(expected))

it('crops in bitmap pixels with the overlay hidden', async () => {
  const guest = fakeGuest()
  const image = fakeImage({ width: 800, height: 600 })
  guest.capture.image = image
  const steps: string[] = []
  const png = await captureElement(guest, { x: 10, y: 20, width: 30, height: 40 }, VIEW, async (a) => steps.push(a))
  expect(steps).toEqual(['hideOverlay', 'showOverlay'])
  expect(image.crops).toEqual([{ x: 20, y: 40, width: 60, height: 80 }])
  expect(png?.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
})

it('restores the overlay when the capture fails', async () => {
  const guest = fakeGuest()
  guest.capture.error = new Error('gone')
  const steps: string[] = []
  await expect(
    captureElement(guest, { x: 0, y: 0, width: 5, height: 5 }, VIEW, async (a) => steps.push(a)),
  ).rejects.toThrow()
  expect(steps).toEqual(['hideOverlay', 'showOverlay'])
})

it.each([
  ['an empty image', () => fakeImage({ width: 0, height: 0 }, true)],
  ['an off-screen rect', () => fakeImage()],
])('returns null for %s', async (name, image) => {
  const guest = fakeGuest()
  guest.capture.image = image()
  const rect =
    name === 'an off-screen rect' ? { x: 900, y: 0, width: 5, height: 5 } : { x: 0, y: 0, width: 5, height: 5 }
  expect(await captureElement(guest, rect, VIEW, async () => undefined)).toBeNull()
})

it('sweepShots removes only files older than the retention', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pragma-sweep-'))
  const now = Date.now()
  const day = 86_400_000
  for (const [name, age] of [
    ['old.png', 8 * day],
    ['new.png', day],
    ['old.txt', 30 * day],
  ] as const) {
    writeFileSync(join(dir, name), 'x')
    utimesSync(join(dir, name), (now - age) / 1000, (now - age) / 1000)
  }
  expect(await sweepShots(dir, 7, now)).toBe(1)
  expect(readdirSync(dir).sort()).toEqual(['new.png', 'old.txt'])
  expect(await sweepShots(join(dir, 'missing'), 7, now)).toBe(0)
})
