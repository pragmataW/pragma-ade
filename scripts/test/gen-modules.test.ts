import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { afterEach, describe, expect, it, test, vi } from 'vitest'
import { generateRegistry } from '../gen-modules.ts'
import { collectExtraResources, planBuilds } from '../lib/builds.ts'
import { discoverModules, discoverModulesWithWarnings } from '../lib/discover.ts'
import { GenerateError } from '../lib/errors.ts'
import { checkMigrationDeps } from '../lib/migration-deps.ts'
import { moduleLocales } from '../lib/render.ts'
import { createTempRepo, featureModule, providerModule, quietRunner } from './lib/temp-repo.ts'

const ids = (root: string, extra: Parameters<typeof discoverModules>[0] = { repoRoot: root }) =>
  discoverModules({ ...extra, repoRoot: root }).map((m) => m.id)
const problemsOf = (fn: () => unknown): string[] => {
  try {
    fn()
  } catch (e) {
    if (e instanceof GenerateError) return e.problems
    throw e
  }
  return []
}
const gen = (root: string, opts: Partial<Parameters<typeof generateRegistry>[0]> = {}) =>
  generateRegistry({ repoRoot: root, run: quietRunner, ...opts })
const read = (file: string) => readFileSync(file, 'utf8')

test('discovers modules and providers sorted', () => {
  const repo = createTempRepo({ ...featureModule('b'), ...featureModule('a'), ...providerModule('p') })
  expect(ids(repo.root)).toEqual(['a', 'b', 'p'])
})

test('skips _template unless includeUnderscored', () => {
  const repo = createTempRepo({ ...featureModule('example', { root: 'modules/_template' }) })
  const files = featureModule('example')
  repo.write(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [k.replace('modules/example', 'modules/_template'), v])),
  )
  expect(ids(repo.root)).toEqual([])
  expect(ids(repo.root, { repoRoot: repo.root, includeUnderscored: true })).toEqual(['example'])
})

test('reports all validation problems at once', () => {
  const repo = createTempRepo({
    ...featureModule('folder-a', { pragma: { id: 'other' }, pkg: { name: '@pragma/module-other' } }),
    ...featureModule('wrongpkg', { pkg: { name: '@pragma/module-zzz' } }),
    ...featureModule('noexport', { pkg: { exports: { './main': './src/main/missing.ts' } } }),
    ...featureModule('badmig', { files: { 'migrations/1_bad.sql': 'SELECT 1;' } }),
    ...featureModule('builder', { pragma: { build: 'nope' } }),
    ...providerModule('noprov'),
  })
  repo.write({ 'modules/nolocale/package.json': featureModule('nolocale')['modules/nolocale/package.json'] as object })
  repo.write({ 'modules/nolocale/src/main/index.ts': 'export default {}\n' })
  rmSync(repo.path('providers/noprov/src/main/provider.ts'))
  expect(problemsOf(() => discoverModules({ repoRoot: repo.root })).sort()).toEqual(
    [
      'modules/badmig: invalid migration name 1_bad.sql (NNNN_name.sql)',
      'modules/builder: pragma.build "nope" is not a script in package.json',
      'modules/folder-a: id "other" does not match folder name "folder-a"',
      'modules/noexport: export ./main → ./src/main/missing.ts does not exist',
      'modules/nolocale: missing English locale locales/en.json',
      'modules/wrongpkg: package name must be @pragma/module-wrongpkg',
      'providers/noprov: provider has no src/main/provider.ts',
    ].sort(),
  )
})

describe('provider locales and capabilities', () => {
  const files = providerModule('p', {
    files: {
      'locales/en/launch.json': { launch: { label: 'Launch' } },
      'src/main/launch.capability.ts': 'export default {}\n',
      'src/renderer/badge.capability.tsx': 'export default {}\n',
      'src/renderer/icon.tsx': 'export default () => null\n',
    },
  })
  test('merges provider locale files per capability into the provider namespace', () => {
    const repo = createTempRepo(files)
    const [mod] = discoverModules({ repoRoot: repo.root })
    expect(mod && moduleLocales(mod).locales.en).toEqual({
      module: { name: 'p' },
      provider: { name: 'p' },
      launch: { label: 'Launch' },
    })
  })
  test('locale key conflict between provider.json and launch.json is reported', () => {
    const repo = createTempRepo({ ...files, 'providers/p/locales/en/launch.json': { provider: { name: 'X' } } })
    expect(problemsOf(() => gen(repo.root, { build: false }))).toEqual([
      'p: locale key provider.name defined in launch.json and provider.json',
    ])
  })
  test('discovers main and renderer capability files', () => {
    const repo = createTempRepo(files)
    const [mod] = discoverModules({ repoRoot: repo.root })
    expect(mod?.provider?.mainCapabilities.map((c) => c.key)).toEqual(['launch'])
    expect(mod?.provider?.rendererCapabilities.map((c) => c.key)).toEqual(['badge'])
    expect(mod?.provider?.iconFile).toBe(repo.path('providers/p/src/renderer/icon.tsx'))
  })
})

describe('roots and warnings', () => {
  afterEach(() => vi.unstubAllEnvs())
  test('extra roots env', () => {
    const repo = createTempRepo({ ...featureModule('x', { root: 'extra/modules' }) })
    vi.stubEnv('PRAGMA_EXTRA_MODULE_ROOTS', repo.path('extra/modules'))
    expect(ids(repo.root)).toEqual(['x'])
  })
  test('unknown dependsOn warns', () => {
    const repo = createTempRepo({ ...featureModule('a', { pragma: { dependsOn: ['ghost'] } }) })
    expect(discoverModulesWithWarnings({ repoRoot: repo.root }).warnings).toEqual([
      'a depends on unknown module "ghost"',
    ])
  })
})

const mig = (id: string, dependsOn: string[], sql: string) => ({
  id,
  dependsOn,
  migrations: [{ file: '1101_x.sql', sql }],
})
const owners = [mig('agents', [], 'CREATE TABLE agents_sessions (id INTEGER);'), mig('projects', [], '')]
it.each([
  ['ALTER without dependency', mig('chat', [], 'ALTER TABLE agents_sessions ADD COLUMN m TEXT;'), 1],
  ['ALTER with dependency', mig('chat', ['agents'], 'ALTER TABLE agents_sessions ADD COLUMN m TEXT;'), 0],
  ['own table', mig('agents', [], 'ALTER TABLE agents_sessions ADD COLUMN m TEXT;'), 0],
  [
    'REFERENCES without dependency',
    mig('board', [], 'CREATE TABLE board_t (w TEXT REFERENCES projects_worktrees(id));'),
    1,
  ],
])('migration deps: %s', (_name, mod, count) => {
  const problems = checkMigrationDeps([...owners.filter((o) => o.id !== mod.id), mod])
  expect(problems).toHaveLength(count)
  if (count)
    expect(problems[0]).toMatch(/^migration 1101_x\.sql touches \w+ owned by \w+ but \w+ does not depend on it$/)
})

const buildScript = (body: string) => `node -e "${body}"`
const appendRun = buildScript("require('fs').appendFileSync('runs.log','x\\\\n')")
const writeMarker = buildScript("require('fs').writeFileSync('marker.txt','built')")

test('planBuilds orders sub-packages before their module', () => {
  const repo = createTempRepo({
    ...featureModule('b', { pragma: { build: 'build' }, pkg: { scripts: { build: writeMarker } } }),
    ...featureModule('a', {
      pragma: { build: 'build' },
      pkg: { scripts: { build: writeMarker } },
      files: {
        'packages/z/package.json': {
          name: '@pragma/module-a-z',
          pragma: { build: 'build' },
          scripts: { build: writeMarker },
        },
        'packages/y/package.json': {
          name: '@pragma/module-a-y',
          pragma: { build: 'build' },
          scripts: { build: writeMarker },
        },
      },
    }),
  })
  const plan = planBuilds(discoverModules({ repoRoot: repo.root }))
  expect(plan.map((s) => s.dir.replace(`${repo.root}/`, ''))).toEqual([
    'modules/a/packages/y',
    'modules/a/packages/z',
    'modules/a',
    'modules/b',
  ])
})

describe('builds', () => {
  const builder = (script: string, pragma: Record<string, unknown> = {}) =>
    createTempRepo(featureModule('m', { pragma: { build: 'build', ...pragma }, pkg: { scripts: { build: script } } }))
  test('runBuilds executes pragma.build scripts', () => {
    const repo = builder(writeMarker)
    gen(repo.root)
    expect(read(repo.path('modules/m/marker.txt'))).toBe('built')
  })
  test('build failure stops gen with package name', () => {
    const repo = builder(buildScript('process.exit(3)'))
    expect(problemsOf(() => gen(repo.root))).toEqual(['build failed: modules/m (build)'])
  })
  test('--no-build skips builds', () => {
    const repo = builder(writeMarker)
    gen(repo.root, { build: false })
    expect(existsSync(repo.path('modules/m/marker.txt'))).toBe(false)
  })

  const runs = (repo: ReturnType<typeof builder>) =>
    existsSync(repo.path('modules/m/runs.log')) ? read(repo.path('modules/m/runs.log')).trim().split('\n').length : 0
  it.each([
    ['second run with unchanged inputs is skipped', () => undefined, {}, 1],
    [
      'editing a file under src/ reruns',
      (r: ReturnType<typeof builder>) => r.write({ 'modules/m/src/x.ts': '1' }),
      {},
      2,
    ],
    [
      'editing the build script text in package.json reruns',
      (r: ReturnType<typeof builder>) => {
        const file = r.path('modules/m/package.json')
        writeFileSync(file, read(file).replace('appendFileSync', 'appendFileSync '))
      },
      {},
      2,
    ],
    [
      'a file outside buildInputs (README.md) does not rerun',
      (r: ReturnType<typeof builder>) => r.write({ 'modules/m/README.md': 'x' }),
      {},
      1,
    ],
    ['missing declared buildOutputs reruns', () => undefined, { buildOutputs: ['dist/**'] }, 2],
  ] as const)('incremental: %s', (_name, change, pragma, expected) => {
    const repo = builder(appendRun, pragma)
    gen(repo.root)
    change(repo)
    const second = gen(repo.root)
    expect(runs(repo)).toBe(expected)
    if (expected === 1) expect(second.builds.skipped).toEqual([repo.path('modules/m')])
  })
  test('incremental: a failed run is not cached', () => {
    const repo = builder(buildScript('process.exit(1)'))
    expect(() => gen(repo.root)).toThrow(GenerateError)
    const file = repo.path('modules/m/package.json')
    writeFileSync(file, read(file).replace('process.exit(1)', "require('fs').appendFileSync('runs.log','x')"))
    expect(gen(repo.root).builds.ran).toEqual([repo.path('modules/m')])
  })
  test('incremental: --force-build reruns', () => {
    const repo = builder(appendRun)
    gen(repo.root)
    gen(repo.root, { forceBuild: true })
    expect(runs(repo)).toBe(2)
  })
})

describe('extra resources', () => {
  test('resources.json lists extraResources with modules/<id>/<to> targets', () => {
    const repo = createTempRepo(
      featureModule('m', {
        pragma: { package: { extraResources: [{ from: 'assets-src', to: 'assets' }] } },
        files: { 'assets-src/a.txt': 'a' },
      }),
    )
    gen(repo.root)
    expect(JSON.parse(read(repo.path('apps/desktop/src/generated/resources.json')))).toEqual([
      { module: 'm', from: repo.path('modules/m/assets-src'), to: 'modules/m/assets', kind: 'dir' },
    ])
  })
  it.each([
    [{ from: '../outside', to: 'x' }, 'm: extraResources ../outside → x escapes its package'],
    [{ from: 'assets-src', to: '../x' }, 'm: extraResources assets-src → ../x escapes its package'],
  ])('escaping from/to is a problem (%o)', (entry, problem) => {
    const repo = createTempRepo(
      featureModule('m', { pragma: { package: { extraResources: [entry] } }, files: { 'assets-src/a.txt': 'a' } }),
    )
    expect(problemsOf(() => gen(repo.root))).toEqual([problem])
  })
  const daemon = (files: Record<string, string>, entry: { from: string; to: string }) =>
    createTempRepo(
      featureModule('term', {
        files: {
          'packages/daemon/package.json': {
            name: '@pragma/module-term-daemon',
            pragma: { package: { extraResources: [entry] } },
          },
          ...Object.fromEntries(Object.entries(files).map(([k, v]) => [`packages/daemon/${k}`, v])),
        },
      }),
    )
  it.each([
    [
      'file',
      { 'dist/daemon.js': 'x' },
      { from: 'dist/daemon.js', to: 'bin/daemon.js' },
      'modules/term/bin/daemon.js',
      'dist/daemon.js',
    ],
    ['dir', { 'dist/a.js': 'x' }, { from: 'dist', to: 'bin' }, 'modules/term/bin', 'dist'],
  ] as const)('sub-package extraResources (%s)', (kind, files, entry, to, from) => {
    const repo = daemon(files, entry)
    const { resources } = collectExtraResources(discoverModules({ repoRoot: repo.root }))
    expect(resources).toEqual([
      { module: 'term', from: repo.path(`modules/term/packages/daemon/${from}`), to, kind, moduleTo: entry.to },
    ])
  })
  test('sub-package: a missing from after the builds is a problem', () => {
    const repo = daemon({}, { from: 'dist/daemon.js', to: 'bin/daemon.js' })
    expect(collectExtraResources(discoverModules({ repoRoot: repo.root })).problems).toEqual([
      'term: extraResources source dist/daemon.js is missing after builds',
    ])
  })
  test('the main registry carries extraResources per record', () => {
    const repo = daemon({ 'dist/daemon.js': 'x' }, { from: 'dist/daemon.js', to: 'bin/daemon.js' })
    gen(repo.root)
    expect(read(repo.path('apps/desktop/src/generated/modules.main.ts'))).toContain(
      JSON.stringify([{ from: repo.path('modules/term/packages/daemon/dist/daemon.js'), to: 'bin/daemon.js' }]),
    )
  })
})

describe('registry output', () => {
  const sample = () =>
    createTempRepo({
      ...featureModule('a', {
        files: {
          'migrations/0001_init.sql': 'CREATE TABLE a_x (id INTEGER);',
          'src/main/test-hooks.ts': 'export default () => {}\n',
        },
      }),
      ...providerModule('p', {
        files: { 'src/main/settings.ts': 'export default {}\n', 'src/main/ping.capability.ts': 'export default {}\n' },
      }),
      'apps/desktop/locales/en.json': { app: { title: 'T' } },
    })
  test('rendered main registry', () => {
    const repo = sample()
    gen(repo.root)
    const text = read(repo.path('apps/desktop/src/generated/modules.main.ts')).replaceAll(repo.root, '<repo>')
    expect(text).toMatchInlineSnapshot(`
      "// AUTO-GENERATED by scripts/gen-modules.ts — do not edit.
      import type { ModuleRecord } from '@pragma/sdk/runtime/main'
      import m0_main from '../../../../modules/a/src/main/index'
      import m0_sql0 from '../../../../modules/a/migrations/0001_init.sql?raw'
      import m1_provider from '../../../../providers/p/src/main/provider'
      import m1_cap0 from '../../../../providers/p/src/main/ping.capability'
      import m1_settings from '../../../../providers/p/src/main/settings'

      export const coreLocales: Record<string, object> = {"en":{"app":{"title":"T"}}}

      export const mainModules: ModuleRecord[] = [
        {
          manifest: {"id":"a","kind":"feature","displayNameKey":"a:module.name","dependsOn":[],"optionalDependsOn":[],"core":false},
          packageName: "@pragma/module-a",
          version: "1.0.0",
          dir: "<repo>/modules/a",
          extraResources: [],
          main: m0_main,
          migrations: [{ name: "0001_init.sql", sql: m0_sql0 }],
          locales: {"en":{"module":{"name":"a"}}},
          testHooks: () => import('../../../../modules/a/src/main/test-hooks'),
        },
        {
          manifest: {"id":"p","kind":"provider","displayNameKey":"p:module.name","dependsOn":[],"optionalDependsOn":[],"core":false},
          packageName: "@pragma/provider-p",
          version: "1.0.0",
          dir: "<repo>/providers/p",
          extraResources: [],
          main: undefined,
          migrations: [],
          locales: {"en":{"module":{"name":"p"},"provider":{"name":"p"}}},
          provider: { descriptor: m1_provider, capabilities: [m1_cap0], settings: m1_settings },
        },
      ]
      "
    `)
  })
  test('idempotent', () => {
    const repo = sample()
    expect(gen(repo.root).written).toHaveLength(3)
    expect(gen(repo.root).written).toEqual([])
  })
  test('a new provider folder is picked up with no other file changed', () => {
    const repo = sample()
    gen(repo.root)
    repo.write(providerModule('newbie'))
    const result = gen(repo.root)
    expect(result.modules.map((m) => m.id)).toEqual(['a', 'newbie', 'p'])
    expect(read(repo.path('apps/desktop/src/generated/modules.renderer.ts'))).toContain(
      'providers/newbie/src/main/provider',
    )
  })
})
