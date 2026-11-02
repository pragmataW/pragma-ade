import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page, test } from '@playwright/test'
import { ShellTestIds } from '@pragma/sdk'
import { createFixtureRepo, type FixtureRepo, isolatedGitEnv } from '@pragma/test-support'
import { forceNativeTheme, type LaunchedApp, launchApp, saveScreen } from '@pragma/test-support/e2e'
// Module contracts by their /contract entry files: the repo root has no @pragma/module-* dependencies (RECON.md).
import { readBridgeInfo } from '../../../modules/bridge/src/client/index.ts'
import { PROJECTS_TESTIDS } from '../../../modules/projects/src/contract/index.ts'
import { TerminalTestIds } from '../../../modules/terminal/src/contract/index.ts'
import { mkTemp } from '../../../scripts/package/lib/fsx.ts'
import {
  BRIDGE_TIMEOUT_MS,
  QUIT_TIMEOUT_MS,
  REPO_ROOT,
  SMOKE_ECHO,
  SMOKE_EXPECT,
  SMOKE_LAUNCH_TIMEOUT_MS,
  type SmokeTarget,
  TERMINAL_TIMEOUT_MS,
  UNAUTHORIZED,
} from './support/constants'
import { extractPackagedApp, type PackagedApp } from './support/packaged-app'

test.describe.configure({ mode: 'serial' })

const PHASE = '12-packaging'

const landed = (id: string): boolean => existsSync(join(REPO_ROOT, 'modules', id, 'package.json'))
const GIT_KEYS = [
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_NOSYSTEM',
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
]

interface Smoke {
  packaged: PackagedApp
  launched: LaunchedApp
  repo: FixtureRepo
  userData: string
  daemonMarker: string
}
let smoke: Smoke | undefined

function gitEnv(): Record<string, string> {
  const env = isolatedGitEnv()
  return Object.fromEntries(GIT_KEYS.map((k) => [k, env[k] ?? '']))
}

/** `ps` lines of processes whose command line mentions `needle`. */
const processesWith = (needle: string): string[] =>
  execFileSync('ps', ['-A', '-o', 'pid=,command='], { encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.includes(needle))

test.beforeAll(async () => {
  const target = test.info().project.metadata.target as SmokeTarget
  const packaged = await extractPackagedApp(target)
  if (!packaged) return
  const temp = mkTemp('pragma smoke')
  const userData = join(temp, 'Pragma Smoke', 'User Data')
  const home = join(temp, 'home')
  mkdirSync(userData, { recursive: true })
  mkdirSync(home, { recursive: true })
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ terminal: { renderer: 'dom' } }))
  const repo = createFixtureRepo({ files: { 'README.md': '# smoke\n' } })
  const launched = await launchApp({
    executablePath: packaged.executablePath,
    userDataDir: userData,
    env: { ...gitEnv(), HOME: home },
    dialogStubs: { openFolder: repo.path },
  })
  smoke = { packaged, launched, repo, userData, daemonMarker: join(packaged.resourcesDir, 'modules', 'terminal') }
})

test.afterAll(async () => {
  await smoke?.launched.close().catch(() => undefined)
  smoke?.repo.cleanup()
})

/** The running smoke app, or a skip when the target was not built. */
function current(): Smoke {
  test.skip(!smoke, 'NOT VERIFIED: target not built (dist/manifest.json)')
  return smoke as Smoke
}

test('launches the packaged shell', async () => {
  const { launched } = current()
  expect(await launched.app.evaluate(({ app }) => app.isPackaged)).toBe(true)
  await expect(launched.window.getByTestId(ShellTestIds.shellReady)).toBeAttached({ timeout: SMOKE_LAUNCH_TIMEOUT_MS })
  expect(await launched.window.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe('undefined')
  expect(launched.console.filter((l) => l.startsWith('error:'))).toEqual([])
})

test('bridge server answers and rejects unauthenticated requests', async () => {
  test.skip(!landed('bridge'), 'NOT VERIFIED: module bridge not landed')
  const { userData } = current()
  const read = () => readBridgeInfo({ env: { PRAGMA_USER_DATA: userData }, userDataDirs: [] }).catch(() => null)
  await expect.poll(read, { timeout: BRIDGE_TIMEOUT_MS }).not.toBeNull()
  const info = await read()
  const res = await fetch(`${info?.url.replace(/\/+$/, '')}/hook`, { method: 'POST', body: '{}' })
  expect(res.status).toBe(UNAUTHORIZED)
})

async function terminalText(page: Page): Promise<string> {
  const rows = page.locator(`[data-testid="${TerminalTestIds.view}"]:visible .xterm-rows`)
  if ((await rows.count()) === 0) return ''
  // biome-ignore lint/performance/useDomNodeTextContent: a Playwright locator; innerText keeps the row line breaks
  return (await rows.first().innerText()).replace(/ /g, ' ').replaceAll('\n', '')
}

test('terminal opens, runs a command, pty-daemon runs from resources', async () => {
  test.skip(!landed('projects') || !landed('terminal'), 'NOT VERIFIED: module projects/terminal not landed')
  const { launched, daemonMarker } = current()
  const page = launched.window
  await page.getByTestId(PROJECTS_TESTIDS.add).click()
  await expect(page.getByTestId(PROJECTS_TESTIDS.worktreeRow).first()).toBeVisible({ timeout: TERMINAL_TIMEOUT_MS })
  await page.getByTestId(ShellTestIds.rightTab('terminal')).click()
  const xterm = page.locator(`[data-testid="${TerminalTestIds.view}"]:visible .xterm`).first()
  await xterm.waitFor({ timeout: TERMINAL_TIMEOUT_MS })
  await xterm.click()
  await page.keyboard.type(SMOKE_ECHO)
  await page.keyboard.press('Enter')
  await expect.poll(() => terminalText(page), { timeout: TERMINAL_TIMEOUT_MS }).toContain(SMOKE_EXPECT)
  expect(processesWith(daemonMarker)).not.toEqual([])
  await screens(launched, `packaged-terminal-${test.info().project.name}`)
})

/** Dark and light screenshots for the phase report (the focused xterm cursor blinks forever: blur first). */
async function screens(launched: LaunchedApp, name: string): Promise<void> {
  await launched.window.evaluate(() =>
    (
      globalThis as unknown as { document: { activeElement: { blur?(): void } | null } }
    ).document.activeElement?.blur?.(),
  )
  for (const mode of ['dark', 'light'] as const) {
    await forceNativeTheme(launched.app, launched.window, mode)
    await saveScreen(launched.window, PHASE, `${name}-${mode}`)
  }
}

test('quitting leaves no pty-daemon process', async () => {
  test.skip(!landed('terminal'), 'NOT VERIFIED: module terminal not landed')
  const { launched, daemonMarker } = current()
  await launched.close()
  await expect.poll(() => processesWith(daemonMarker), { timeout: QUIT_TIMEOUT_MS }).toEqual([])
})
