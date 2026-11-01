import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROVIDER_SETTINGS_SECTION } from '@pragma/sdk'
import { createTestModuleHost, loadModuleRecord } from '@pragma/test-support'
import { afterEach, describe, expect, it } from 'vitest'
import { discoverModuleDir } from '../../scripts/lib/discover.ts'
import { REPO_ROOT } from './lib/workspace.ts'

const PROVIDERS = [
  { id: 'claude', command: 'claude', monogram: 'CL', moduleName: 'Claude Code provider', name: 'Claude Code' },
  { id: 'opencode', command: 'opencode', monogram: 'OC', moduleName: 'OpenCode provider', name: 'OpenCode' },
  { id: 'custom', command: '', monogram: '>_', moduleName: 'Custom agent provider', name: 'Custom agent' },
]
const dirOf = (id: string): string => join(REPO_ROOT, 'providers', id)

describe.each(PROVIDERS)('provider $id', (p) => {
  it('is discovered as a provider with descriptor, icon and settings files', () => {
    const mod = discoverModuleDir(dirOf(p.id))
    expect(mod.id).toBe(p.id)
    expect(mod.packageName).toBe(`@pragma/provider-${p.id}`)
    expect(mod.manifest).toMatchObject({ kind: 'provider', core: false, dependsOn: [], optionalDependsOn: [] })
    expect(mod.provider?.iconFile).toBe(join(dirOf(p.id), 'src/renderer/icon.tsx'))
    expect(mod.provider?.settingsFile).toBe(join(dirOf(p.id), 'src/main/settings.ts'))
    // later phases add their own `<key>.capability.ts` files (§3); the skeleton itself declares none
    for (const cap of mod.provider?.mainCapabilities ?? []) expect(cap.file).toMatch(/\.capability\.ts$/)
  })

  it('loads a record with the descriptor, the shared settings section and provider.json', async () => {
    const record = await loadModuleRecord(dirOf(p.id))
    expect(record.provider?.descriptor).toEqual({
      id: p.id,
      displayNameKey: `${p.id}:provider.name`,
      icon: p.id,
      defaultCommand: p.command,
      defaultArgs: [],
    })
    expect(record.provider?.settings).toBe(PROVIDER_SETTINGS_SECTION)
    for (const cap of record.provider?.capabilities ?? []) expect(cap.providerId).toBe(p.id)
    expect(record.locales.en).toMatchObject({ module: { name: p.moduleName }, provider: { name: p.name } })
  })

  it('declares its monogram in constants', () => {
    const constants = readFileSync(join(dirOf(p.id), 'src/constants.ts'), 'utf8')
    expect(constants).toContain(`MONOGRAM = '${p.monogram}'`)
  })
})

describe('registered in a test host with no capabilities', () => {
  let dispose: (() => Promise<void>) | undefined
  afterEach(async () => {
    await dispose?.()
    dispose = undefined
  })

  it('lists all three providers, sorted, with no capability', async () => {
    const records = await Promise.all(PROVIDERS.map((p) => loadModuleRecord(dirOf(p.id))))
    const t = await createTestModuleHost({ modules: records })
    dispose = t.dispose
    expect(t.host.providers.list().map((d) => d.id)).toEqual(['claude', 'custom', 'opencode'])
    expect(t.host.i18n.t('claude:provider.name')).toBe('Claude Code')
    expect(t.host.settings.get('opencode')).toEqual({})
  })
})
