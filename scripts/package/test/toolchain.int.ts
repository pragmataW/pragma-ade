import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { MIN_ARTIFACT_BYTES } from '../constants.ts'
import { readManifest } from '../lib/report.ts'
import { TARGET_IDS, type TargetId } from '../lib/targets.ts'
import { MINI_DIST, prepareMiniRepo, runCli } from './support/fixture-paths.ts'

const EXPECTED: Record<TargetId, RegExp[]> = {
  'darwin-arm64': [/\.dmg$/, /\.zip$/],
  'darwin-x64': [/\.dmg$/, /\.zip$/],
  'linux-x64': [/\.AppImage$/, /\.deb$/],
  'win32-x64': [/-setup\.exe$/, /\.zip$/],
}

it('cli build all on the mini repo produces every target', async () => {
  const mini = await prepareMiniRepo()
  const r = await runCli(['build', 'all', '--repo', mini, '--skip-app-build'])
  const manifest = readManifest(MINI_DIST)
  for (const id of TARGET_IDS) {
    expect(manifest?.targets[id]?.error, id).toBeUndefined()
    const names = readdirSync(join(MINI_DIST, id))
    for (const re of EXPECTED[id]) {
      const hit = names.find((n) => re.test(n))
      expect(hit, `${id} ${re}`).toBeDefined()
      expect(statSync(join(MINI_DIST, id, hit as string)).size).toBeGreaterThan(MIN_ARTIFACT_BYTES)
    }
  }
  expect(r.code, r.stderr.slice(-2000)).toBe(0)
})
