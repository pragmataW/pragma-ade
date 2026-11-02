import type { ModelInfo } from '@anthropic-ai/claude-agent-sdk'
import { describe, expect, it } from 'vitest'
import { type ClaudeOptionState, describeClaudeOptions, planModes } from '../../src/main/chat/options'
import { isKind, readReport, startSession } from './support'

/** Shaped like the real `supportedModels()` of a Max account (2026-11). */
const MODELS: ModelInfo[] = [
  {
    value: 'default',
    displayName: 'Default (recommended)',
    description: 'Opus 5',
    supportsEffort: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    supportsFastMode: true,
    supportsAutoMode: true,
  },
  { value: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5', description: 'Fastest' },
  {
    value: 'claude-sonnet-4-6',
    displayName: 'Sonnet 4.6',
    description: '',
    supportsEffort: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'max'],
    supportsAutoMode: true,
  },
]
const state = (s: Partial<ClaudeOptionState> = {}): ClaudeOptionState => ({
  model: null,
  effort: null,
  permissionMode: 'default',
  fastMode: false,
  ...s,
})
const describe$ = (s: Partial<ClaudeOptionState> = {}) => describeClaudeOptions({ models: MODELS }, state(s))
const option = (key: string, s: Partial<ClaudeOptionState> = {}) => describe$(s).find((o) => o.key === key)
const values = (key: string, s: Partial<ClaudeOptionState> = {}) => option(key, s)?.values?.map((v) => v.value)

describe('describeClaudeOptions', () => {
  it('model: every supported model; the CLI default row is the null choice with its name and description', () => {
    expect(option('model')?.values).toEqual([
      { value: null, label: 'Default (recommended)', description: 'Opus 5' },
      { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', description: 'Fastest' },
      { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
    ])
    expect(option('model', { model: 'default' })?.current).toBeNull()
  })

  it('effort: only the model levels; none for a model without effort; an unsupported level reads as default', () => {
    expect(values('effort')).toEqual([null, 'low', 'medium', 'high', 'xhigh', 'max'])
    expect(values('effort', { model: 'claude-sonnet-4-6' })).not.toContain('xhigh')
    expect(option('effort', { model: 'claude-haiku-4-5-20251001' })).toBeUndefined()
    expect(option('effort', { model: 'claude-sonnet-4-6', effort: 'xhigh' })?.current).toBeNull()
  })

  it('fastMode: a boolean only for models that support it', () => {
    expect(option('fastMode', { fastMode: true })).toMatchObject({ type: 'boolean', current: true, default: false })
    expect(option('fastMode', { model: 'claude-sonnet-4-6' })).toBeUndefined()
  })

  it('permissionMode: six modes with tones and descriptions; bypass is dangerous, confirmed and out of the cycle', () => {
    const modes = option('permissionMode')?.values ?? []
    expect(modes.map((m) => [m.value, m.tone])).toEqual([
      ['default', 'neutral'],
      ['acceptEdits', 'info'],
      ['plan', 'ok'],
      ['auto', 'accent'],
      ['dontAsk', 'warn'],
      ['bypassPermissions', 'err'],
    ])
    expect(modes.every((m) => m.labelKey && m.descriptionKey)).toBe(true)
    expect(modes.at(-1)).toMatchObject({ dangerous: true, requiresConfirm: true, cycle: false })
  })

  it('auto mode only for models that support it (kept while it is the current mode)', () => {
    const haiku = { model: 'claude-haiku-4-5-20251001' }
    expect(values('permissionMode', haiku)).not.toContain('auto')
    expect(values('permissionMode', { ...haiku, permissionMode: 'auto' })).toContain('auto')
    expect(planModes(describe$(haiku))).toEqual(['acceptEdits', 'default'])
  })
})

describe('ClaudeChatSession options (fake CLI)', () => {
  it.each(['acceptEdits', 'plan', 'auto', 'dontAsk', 'bypassPermissions', 'default'])(
    'setOption permissionMode %s → set_permission_mode',
    async (mode) => {
      const s = await startSession('basic')
      await s.session.setOption('permissionMode', mode)
      const requests = readReport(s.home.report)
        .at(-1)
        ?.controlRequests.map((f) => f.request)
      expect(requests).toContainEqual(expect.objectContaining({ subtype: 'set_permission_mode', mode }))
      expect(s.session.describeOptions().find((o) => o.key === 'permissionMode')?.current).toBe(mode)
    },
  )

  it('bypass is allowed mid-session (the CLI starts with --allow-dangerously-skip-permissions)', async () => {
    const s = await startSession('basic')
    expect(s.report()?.argv).toContain('--allow-dangerously-skip-permissions')
  })

  it('fastMode → apply_flag_settings fastMode; re-applied at start when resumed with it on', async () => {
    const s = await startSession('basic')
    await s.session.setOption('fastMode', true)
    expect(s.session.describeOptions().find((o) => o.key === 'fastMode')?.current).toBe(true)
    const resumed = await startSession('basic', { ctx: { initialOptions: { fastMode: true } } })
    await resumed.send('hi')
    await resumed.waitForEvent(isKind('turn-end'))
    for (const r of [s.report(), resumed.report()])
      expect(r?.controlRequests.map((f) => f.request)).toContainEqual(
        expect.objectContaining({ subtype: 'apply_flag_settings', settings: { fastMode: true } }),
      )
  })
})
