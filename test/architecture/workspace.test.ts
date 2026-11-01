import { join } from 'node:path'
import { expect, test } from 'vitest'
import { allWorkspacePackageJsons, REPO_ROOT, readPackageJson, readWorkspaceYaml } from './lib/workspace.ts'

const CONTRACT_GLOBS = [
  'apps/*',
  'packages/*',
  'modules/*',
  'modules/*/packages/*',
  'providers/*',
  'providers/*/packages/*',
]
const REQUIRED_BUILDS = ['electron', 'esbuild', 'better-sqlite3', 'node-pty', '@parcel/watcher']
const EXACT_VERSION = /^(workspace:\*|\d+\.\d+\.\d+)$/
const ws = readWorkspaceYaml('pnpm-workspace.yaml')
const rootPkg = readPackageJson(join(REPO_ROOT, 'package.json'))

test('workspace lists the contract globs', () => expect(ws.packages).toEqual(expect.arrayContaining(CONTRACT_GLOBS)))
test.each(REQUIRED_BUILDS)('allowBuilds approves %s', (name) => expect(ws.allowBuilds[name]).toBe(true))
test.each(allWorkspacePackageJsons())('$name pins exact versions', (pkg) => {
  for (const [dep, v] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies }))
    expect(v, dep).toMatch(EXACT_VERSION)
})
test.each(['mac', 'linux', 'win', 'all'])('package:%s script exists', (t) =>
  expect(rootPkg.scripts?.[`package:${t}`]).toBeDefined(),
)
