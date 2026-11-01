import { join } from 'node:path'
import type { ElectronApplication, Locator, Page } from '@playwright/test'
import type { ThemeMode } from '@pragma/sdk'
import { type PragmaTestWindow, ShellTestIds as T, type TestTabSpec } from '@pragma/sdk'
import { findRepoRoot } from '../node/repo-root'
import {
  DARWIN,
  DND_ACTIVATION_PX,
  DND_STEPS,
  HALF,
  PALETTE_KEYS,
  PNG,
  SCREENS_DIR,
  THEME_ATTRIBUTE,
} from './constants'

export class NoBoundingBoxError extends Error {}

/** Page globals used inside `evaluate` (serialized to the page; this package compiles without the DOM lib). */
interface PageGlobals {
  requestAnimationFrame(cb: () => void): number
  document: { getAnimations(): { finished: Promise<unknown> }[] }
}

const nextFrame = (page: Page): Promise<void> =>
  page.evaluate(
    () => new Promise<void>((resolve) => (globalThis as unknown as PageGlobals).requestAnimationFrame(() => resolve())),
  )

async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await locator.boundingBox()
  if (!b) throw new NoBoundingBoxError('element has no bounding box (not visible?)')
  return b
}

async function centre(locator: Locator): Promise<{ x: number; y: number }> {
  const b = await box(locator)
  return { x: b.x + b.width / HALF, y: b.y + b.height / HALF }
}

/** Rendered width (px) of the element with this test id; 0 when it is not laid out. */
export async function paneWidth(window: Page, testId: string): Promise<number> {
  return (await window.getByTestId(testId).boundingBox())?.width ?? 0
}

/** Drags a separator horizontally by `dx` px with real mouse events. */
export async function dragSeparator(window: Page, testId: string, dx: number): Promise<void> {
  const start = await centre(window.getByTestId(testId))
  await window.mouse.move(start.x, start.y)
  await window.mouse.down()
  await window.mouse.move(start.x + dx, start.y, { steps: DND_STEPS })
  await window.mouse.up()
}

/** Opens the settings view, then the page `pageId` when given. */
export async function openSettingsPage(window: Page, pageId?: string): Promise<void> {
  await window.getByTestId(T.openSettings).click()
  await window.getByTestId(T.settingsView).waitFor()
  if (!pageId) return
  await window.getByTestId(T.settingsNav(pageId)).click()
  await window.getByTestId(T.settingsPage(pageId)).waitFor()
}

/** Opens the command palette with ⌘K (macOS) / Ctrl+K. */
export async function openCommandPalette(window: Page): Promise<void> {
  await window.keyboard.press(process.platform === DARWIN ? PALETTE_KEYS.darwin : PALETTE_KEYS.other)
  await window.getByTestId(T.commandPalette).waitFor()
}

/** Registers a right-panel tab through `window.__pragmaTest` (test mode only). */
export async function registerTestTab(window: Page, tab: TestTabSpec): Promise<void> {
  await window.evaluate((t) => (globalThis as unknown as PragmaTestWindow).__pragmaTest.registerRightTab(t), tab)
}

/** Ids of the registered right-panel tabs in strip order. */
export function rightTabIds(window: Page): Promise<string[]> {
  return window.evaluate(() => (globalThis as unknown as PragmaTestWindow).__pragmaTest.rightTabIds())
}

/** Runs a command in the renderer through `window.__pragmaTest`. */
export function executeCommand(window: Page, id: string, args?: unknown): Promise<unknown> {
  return window.evaluate(([c, a]) => (globalThis as unknown as PragmaTestWindow).__pragmaTest.execute(c, a), [
    id,
    args,
  ] as const)
}

/** Pointer drag that `@dnd-kit` pointer sensors accept: press, pass the activation distance, move in steps, release. */
export async function dragTo(
  page: Page,
  source: Locator,
  target: Locator,
  opts: { steps?: number } = {},
): Promise<void> {
  const from = await centre(source)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x, from.y + DND_ACTIVATION_PX)
  await nextFrame(page)
  const to = await centre(target)
  const steps = opts.steps ?? DND_STEPS
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps
    const y = from.y + DND_ACTIVATION_PX + ((to.y - from.y - DND_ACTIVATION_PX) * i) / steps
    await page.mouse.move(x, y)
    await nextFrame(page)
  }
  await page.mouse.up()
  await nextFrame(page)
}

/**
 * Forces the OS appearance (`nativeTheme.themeSource`) so a `system` theme resolves to `mode`, then waits until the
 * shell applied it. Used for dark + light screenshots; settings-general's mode setting overrides it.
 */
export async function forceNativeTheme(app: ElectronApplication, window: Page, mode: ThemeMode): Promise<void> {
  await app.evaluate(({ nativeTheme }, m) => {
    nativeTheme.themeSource = m
  }, mode)
  await window.locator(`html[${THEME_ATTRIBUTE}="${mode}"]`).waitFor({ state: 'attached' })
}

/** Waits until every running CSS animation/transition has finished (dialogs fade in). */
export async function settleAnimations(window: Page): Promise<void> {
  await window.evaluate(() =>
    Promise.all(
      (globalThis as unknown as PageGlobals).document.getAnimations().map((a) => a.finished.catch(() => undefined)),
    ),
  )
  await nextFrame(window)
}

/** Saves a full-window screenshot to `docs/phases/reports/<phase>/screens/<name>.png`. */
export async function saveScreen(window: Page, phase: string, name: string): Promise<string> {
  const path = join(findRepoRoot(), SCREENS_DIR(phase), `${name}${PNG}`)
  await settleAnimations(window)
  await window.screenshot({ path })
  return path
}
