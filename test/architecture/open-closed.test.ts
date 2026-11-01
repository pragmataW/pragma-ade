import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createFakePlatform,
  createTempUserData,
  createTestModuleHost,
  loadModuleRecord,
  type TestModuleHost,
} from '@pragma/test-support'
import { afterEach, describe, expect, it } from 'vitest'
import { generateRegistry } from '../../scripts/gen-modules.ts'
import { discoverModulesWithWarnings } from '../../scripts/lib/discover.ts'
import { ProbeIpc } from './fixtures/extension-proof/modules/probe/src/contract'
import { DEFAULT_ROOTS, loadProbeRecords, PROBE_DIR, PROOF_ROOTS } from './lib/probe.ts'
import { REPO_ROOT } from './lib/workspace.ts'

const CORE_DIRS = ['apps', 'packages', 'scripts', 'modules', 'providers']
const PROBE_NAMES = ['@pragma/module-probe', '@pragma/provider-probe-provider', 'probe-provider']
const ids = (roots: string[]) =>
  discoverModulesWithWarnings({ repoRoot: REPO_ROOT, roots })
    .modules.map((m) => m.id)
    .sort()

const hosts: TestModuleHost[] = []
const cleanups: (() => void)[] = []
afterEach(async () => {
  for (const h of hosts.splice(0)) await h.dispose()
  for (const c of cleanups.splice(0)) c()
})

async function probeHost(opts: { userDataDir?: string } = {}) {
  const t = await createTestModuleHost({ modules: await loadProbeRecords(), testMode: false, ...opts })
  hosts.push(t)
  return t
}

describe('open/closed proof', () => {
  it('fixture adds a module and a provider without touching core', () => {
    const before = ids(DEFAULT_ROOTS)
    const after = ids(PROOF_ROOTS)
    expect(after.filter((id) => !before.includes(id))).toEqual(['probe', 'probe-provider'])
    // No tracked core file names the fixture: everything it needs comes from the SDK contract.
    const tracked = execFileSync('git', ['ls-files', '-z', '--', ...CORE_DIRS], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
    const mentions = tracked.filter((f) => {
      const text = readFileSync(join(REPO_ROOT, f), 'utf8')
      return PROBE_NAMES.some((n) => text.includes(n))
    })
    expect(mentions).toEqual([])
  })

  it('probe activates through the real host', async () => {
    const userData = createTempUserData()
    cleanups.push(userData.cleanup)
    const t = await probeHost({ userDataDir: userData.path })
    expect(await t.ipc.invoke(ProbeIpc.ping, { msg: 'x' })).toEqual({ pong: 'x:hello' })
    expect(await t.ipc.invoke(ProbeIpc.countItems, undefined)).toEqual({ count: 1 })
    expect(await t.ipc.invoke(ProbeIpc.providerPings, undefined)).toEqual(['probe-provider:pong'])
    expect(t.host.settings.get('probe')).toEqual({ greeting: 'hello' })
    await t.dispose()
    hosts.splice(hosts.indexOf(t), 1)
    const second = await probeHost({ userDataDir: userData.path })
    expect(await second.ipc.invoke(ProbeIpc.countItems, undefined)).toEqual({ count: 1 })
    const rows = second.host.sqlite.prepare("SELECT count(*) AS n FROM schema_migrations WHERE module = 'probe'").get()
    expect(rows).toEqual({ n: 1 })
  })

  it('capability factory dispose runs on host dispose', async () => {
    const userData = createTempUserData()
    cleanups.push(userData.cleanup)
    const t = await probeHost({ userDataDir: userData.path })
    await t.ipc.invoke(ProbeIpc.providerPings, undefined)
    await t.host.dispose()
    expect(existsSync(join(userData.path, 'providers', 'probe-provider', 'disposed.txt'))).toBe(true)
  })

  it('gen with fixture roots runs the probe build and lists extraResources', () => {
    const outDir = mkdtempSync(join(tmpdir(), 'pragma-gen-'))
    cleanups.push(() => rmSync(outDir, { recursive: true, force: true }))
    generateRegistry({ repoRoot: REPO_ROOT, roots: PROOF_ROOTS, outDir })
    expect(readFileSync(join(PROBE_DIR, 'build-output', 'marker.txt'), 'utf8')).toBe('built')
    const resources = JSON.parse(readFileSync(join(outDir, 'resources.json'), 'utf8'))
    expect(resources).toContainEqual(expect.objectContaining({ module: 'probe', to: 'modules/probe/assets' }))
  })

  it('resource path agrees with packaging', async () => {
    const R = '/opt/pragma/resources'
    const t = await createTestModuleHost({
      modules: await loadProbeRecords(),
      testMode: false,
      platform: createFakePlatform({ packaged: true, resourcesPath: R }),
    })
    hosts.push(t)
    const packaged = await t.ipc.invoke(ProbeIpc.resourcePath, { rel: 'assets/marker.txt' })
    const outDir = mkdtempSync(join(tmpdir(), 'pragma-gen-'))
    cleanups.push(() => rmSync(outDir, { recursive: true, force: true }))
    generateRegistry({ repoRoot: REPO_ROOT, roots: PROOF_ROOTS, outDir })
    const entry = (
      JSON.parse(readFileSync(join(outDir, 'resources.json'), 'utf8')) as { module: string; to: string }[]
    ).find((r) => r.module === 'probe')
    expect(packaged).toBe(`${R}/modules/probe/assets/marker.txt`)
    expect(packaged).toBe(`${R}/${entry?.to}/marker.txt`)
  })

  it('provider locale files merge', async () => {
    const t = await probeHost()
    expect(t.host.i18n.t('probe-provider:ping.label')).toBe('Ping')
    expect(t.host.i18n.t('probe-provider:badge.label')).toBe('Probe badge')
  })

  it('in-test fake provider from a temp folder registers with zero core changes', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'pragma-fake-provider-')), 'fake-agent')
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    mkdirSync(join(dir, 'src', 'main'), { recursive: true })
    mkdirSync(join(dir, 'locales', 'en'), { recursive: true })
    const manifest = { id: 'fake-agent', kind: 'provider', displayNameKey: 'fake-agent:module.name' }
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: '@pragma/provider-fake-agent', version: '0.0.1', pragma: manifest }),
    )
    writeFileSync(
      join(dir, 'src', 'main', 'provider.ts'),
      "export default { id: 'fake-agent', displayNameKey: 'fake-agent:provider.name', icon: 'fake-agent', defaultCommand: 'fake', defaultArgs: [] }\n",
    )
    writeFileSync(
      join(dir, 'locales', 'en', 'provider.json'),
      JSON.stringify({ module: { name: 'Fake' }, provider: { name: 'Fake agent' } }),
    )
    const t = await createTestModuleHost({ modules: [await loadModuleRecord(dir)], testMode: false })
    hosts.push(t)
    expect(t.host.providers.list().map((p) => p.id)).toEqual(['fake-agent'])
    expect(t.host.i18n.t('fake-agent:provider.name')).toBe('Fake agent')
  })
})
