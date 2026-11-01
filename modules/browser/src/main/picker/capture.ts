// Adapted from stablyai/orca src/main/browser/browser-grab-screenshot.ts (MIT) — see THIRD_PARTY_NOTICES.md
import { readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@pragma/sdk/main'
import { MS_PER_DAY, PNG_EXT } from '../../constants'
import type { Rect, Viewport } from '../../contract'
import type { GuestLike } from '../guest'
import { PICKER_ACTION, type PickerAction } from './script'

/** The part of `rect` inside the viewport, rounded outward; null when less than one pixel is left. */
export function clampCaptureRect(rect: Rect, viewport: Viewport): Rect | null {
  const left = Math.floor(Math.max(0, rect.x))
  const top = Math.floor(Math.max(0, rect.y))
  const right = Math.ceil(Math.min(viewport.width, rect.x + rect.width))
  const bottom = Math.ceil(Math.min(viewport.height, rect.y + rect.height))
  if (right - left < 1 || bottom - top < 1) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * One `capturePage()` with the picker overlay hidden (restored in `finally`), cropped to the element and scaled from
 * CSS pixels to the bitmap. Null for an off-screen/zero-size element or an empty image.
 */
export async function captureElement(
  guest: GuestLike,
  rect: Rect,
  viewport: Viewport,
  overlay: (action: PickerAction) => Promise<unknown>,
): Promise<Buffer | null> {
  const clamped = clampCaptureRect(rect, viewport)
  if (!clamped) return null
  await overlay(PICKER_ACTION.hideOverlay)
  let image: Awaited<ReturnType<GuestLike['capturePage']>>
  try {
    image = await guest.capturePage()
  } finally {
    await overlay(PICKER_ACTION.showOverlay).catch(() => undefined)
  }
  if (image.isEmpty()) return null
  const bitmap = image.getSize()
  const scale = bitmap.width / viewport.width
  const x = Math.floor(clamped.x * scale)
  const y = Math.floor(clamped.y * scale)
  const crop = {
    x,
    y,
    width: Math.min(bitmap.width - x, Math.ceil(clamped.width * scale)),
    height: Math.min(bitmap.height - y, Math.ceil(clamped.height * scale)),
  }
  if (crop.width < 1 || crop.height < 1) return null
  return image.crop(crop).toPNG()
}

/** `<dir>/<pickId>.png`. */
export async function saveShot(dir: string, pickId: string, png: Buffer): Promise<string> {
  const path = join(dir, pickId + PNG_EXT)
  writeFileAtomic(path, png)
  return path
}

/** Deletes screenshots older than `maxAgeDays`; returns how many were removed (a missing dir is empty). */
export async function sweepShots(dir: string, maxAgeDays: number, now: number): Promise<number> {
  const names = await readdir(dir).catch(() => [] as string[])
  const cutoff = now - maxAgeDays * MS_PER_DAY
  let removed = 0
  for (const name of names.filter((n) => n.endsWith(PNG_EXT))) {
    const path = join(dir, name)
    const info = await stat(path).catch(() => null)
    if (!info || info.mtimeMs >= cutoff) continue
    await unlink(path).catch(() => undefined)
    removed++
  }
  return removed
}
