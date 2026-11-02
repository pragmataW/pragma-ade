import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { extractArchive } from '../lib/archive.ts'
import { buildTargets } from '../lib/pipeline.ts'
import { exitCodeFor } from '../lib/report.ts'
import { prepareMiniRepo, useIntCache } from './support/fixture-paths.ts'

const DIR = join(tmpdir(), 'pragma mini rerun')
const DAEMON_PKG = 'modules/terminal/packages/pty-daemon/package.json'
let mini = ''
const build = () =>
  buildTargets({
    repoRoot: mini,
    targets: ['darwin-arm64'],
    skipAppBuild: true,
    dockerAutoStart: false,
    keepStage: false,
    deep: false,
  })

beforeAll(async () => {
  useIntCache()
  mini = await prepareMiniRepo(DIR)
})

it('re-running gives the same resources; removing a declaration removes it from the package', async () => {
  const first = await build()
  const second = await build()
  expect(second.targets['darwin-arm64']?.status).toBe('ok')
  expect(second.targets['darwin-arm64']?.resources).toEqual(first.targets['darwin-arm64']?.resources)
  expect(second.targets['darwin-arm64']?.resources.map((r) => r.dest)).toEqual(['modules/terminal/pty-daemon'])

  const pkgPath = join(mini, DAEMON_PKG)
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  delete pkg.pragma.package
  writeFileSync(pkgPath, JSON.stringify(pkg))
  const third = await build()
  const t = third.targets['darwin-arm64']
  expect(t?.status).toBe('ok')
  expect(t?.resources).toEqual([])
  expect(third.unpackagedBuilds.map((b) => b.packageName)).toEqual(['@mini/terminal-pty-daemon'])
  const zip = readdirSync(join(mini, 'dist/darwin-arm64')).find((n) => n.endsWith('.zip')) as string
  const root = await extractArchive(join(mini, 'dist/darwin-arm64', zip))
  expect(existsSync(join(root, 'Pragma ADE.app/Contents/Resources/modules/terminal'))).toBe(false)
  expect(exitCodeFor(third, ['darwin-arm64'])).toBe(2)
})
