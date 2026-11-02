import { describe, expect, it } from 'vitest'
import { applyFirstRunDefaults } from '../src/defaults'
import { fakeApi } from './fakes/vscode'

describe('applyFirstRunDefaults', () => {
  it('first-run defaults applied once; second run does not overwrite user change', async () => {
    const api = fakeApi()
    expect(await applyFirstRunDefaults(api, 'Dark Modern')).toBe(true)
    expect(api.config.get('workbench.colorTheme')).toBe('Dark Modern')
    expect(api.config.get('telemetry.telemetryLevel')).toBe('off')
    expect(api.config.get('update.mode')).toBe('none')
    expect(api.config.get('extensions.autoUpdate')).toBe(false)
    api.config.set('workbench.startupEditor', 'welcomePage')
    expect(await applyFirstRunDefaults(api, 'Light Modern')).toBe(false)
    expect(api.config.get('workbench.startupEditor')).toBe('welcomePage')
    expect(api.config.get('workbench.colorTheme')).toBe('Dark Modern')
  })
})
