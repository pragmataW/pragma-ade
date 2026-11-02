import { describe, expect, it } from 'vitest'
import { STATE_KEYS } from '../src/constants'
import { applyFirstRunDefaults, DEFAULTS_VERSION } from '../src/defaults'
import { fakeApi } from './fakes/vscode'

const MONO = "'JetBrains Mono Variable', 'JetBrains Mono', monospace"

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

  it('a fresh install gets the app fonts', async () => {
    const api = fakeApi()
    await applyFirstRunDefaults(api, 'Dark Modern')
    expect(api.config.get('editor.fontFamily')).toBe(MONO)
    expect(api.config.get('editor.fontSize')).toBe(12.5)
    expect(api.config.get('editor.lineHeight')).toBe(20)
    expect(api.config.get('terminal.integrated.fontFamily')).toBe(MONO)
    expect(api.state.get(STATE_KEYS.defaultsVersion)).toBe(DEFAULTS_VERSION)
  })

  it('v1 → v2 writes only the font keys and keeps the user theme and settings', async () => {
    const api = fakeApi()
    api.state.set(STATE_KEYS.defaultsVersion, 1)
    api.config.set('workbench.colorTheme', 'Solarized Light')
    api.config.set('workbench.startupEditor', 'welcomePage')
    expect(await applyFirstRunDefaults(api, 'Dark Modern')).toBe(true)
    expect(api.config.get('workbench.colorTheme')).toBe('Solarized Light')
    expect(api.config.get('workbench.startupEditor')).toBe('welcomePage')
    expect(api.config.has('telemetry.telemetryLevel')).toBe(false)
    expect(api.config.get('editor.fontFamily')).toBe(MONO)
    expect(api.config.get('terminal.integrated.fontFamily')).toBe(MONO)
    expect(api.state.get(STATE_KEYS.defaultsVersion)).toBe(DEFAULTS_VERSION)
  })
})
