import { describe, expect, it } from 'vitest'
import { changeOf, patchToHunks } from '../src/main/chat/mapping/diff'
import { outcomeOf, parseSlash, permissionOptions, toDecision, toPrompt } from '../src/main/chat/mapping/input'
import {
  applyOption,
  buildOptionDescriptors,
  type Catalog,
  contextWindowOf,
  modelInputOf,
  modelRefOf,
} from '../src/main/chat/mapping/options'
import { toolKindOf, toolTitleOf } from '../src/main/chat/mapping/tool-kind'
import { agentInfoSchema, modelInfoSchema } from '../src/main/chat/schemas'
import { readScenario } from '../testing/fake-opencode-server/harness'

const EDIT_PATCH = '--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-a\n+b\n'
const TWO_HUNKS = '@@ -1,2 +1,2 @@\n x\n-a\n+b\n@@ -10,2 +10,2 @@\n y\n-c\n+d\n\\ No newline at end of file\n'

const scenario = readScenario('basic') as unknown as { models: unknown[]; agents: unknown[] }
const models = scenario.models.map((m) => modelInfoSchema.parse(m))
const catalog: Catalog = {
  models,
  defaultModel: models[0] ?? null,
  agents: scenario.agents.map((a) => agentInfoSchema.parse(a)),
}

describe('tool kinds and titles', () => {
  it.each([
    ['shell', 'shell'],
    ['bash', 'shell'],
    ['read', 'read'],
    ['grep', 'search'],
    ['glob', 'search'],
    ['edit', 'edit'],
    ['apply_patch', 'edit'],
    ['write', 'write'],
    ['websearch', 'web'],
    ['subagent', 'task'],
    ['todo', 'todo'],
    ['mystery', 'other'],
    ['constructor', 'other'],
  ])('toolKindOf %s', (n, k) => expect(toolKindOf(n)).toBe(k))

  it.each([
    ['read', { path: 'README.md' }, 'README.md'],
    ['edit', { filePath: 'a.ts', oldString: 'x' }, 'a.ts'],
    ['shell', { command: 'ls -la' }, 'ls -la'],
    ['grep', { pattern: 'foo' }, 'foo'],
    ['webfetch', { url: 'https://x' }, 'https://x'],
    ['subagent', { description: 'explore' }, 'explore'],
    ['todo', { todos: [] }, undefined],
    ['read', null, undefined],
  ])('toolTitleOf %s %j', (name, input, title) => expect(toolTitleOf(name, input)).toBe(title))
})

describe('diff hunks', () => {
  it('patchToHunks: single and multi hunk, no-newline marker', () => {
    expect(patchToHunks(EDIT_PATCH)).toEqual([{ before: 'a', after: 'b' }])
    expect(patchToHunks(TWO_HUNKS)).toEqual([
      { before: 'x\na', after: 'x\nb' },
      { before: 'y\nc', after: 'y\nd' },
    ])
    expect(patchToHunks('')).toEqual([])
  })

  it.each([
    ['modified', 'edit'],
    ['added', 'create'],
    ['deleted', 'delete'],
  ] as const)('changeOf %s', (s, c) => expect(changeOf(s)).toBe(c))
})

describe('prompt input', () => {
  const exists = (abs: string) => abs === '/w/src/a.ts' || abs === '/abs/b.md'

  it('toPrompt: images inline, existing @mentions become file attachments with ranges, missing ones stay text', () => {
    const text = 'see @src/a.ts and @missing.ts plus @/abs/b.md'
    const p = toPrompt(
      { text, images: [{ name: 'shot.png', mediaType: 'image/png', dataBase64: 'AAA' }] },
      '/w',
      exists,
    )
    expect(p.text).toBe(text)
    expect(p.files).toEqual([
      { uri: 'data:image/png;base64,AAA', source: { type: 'inline' }, name: 'shot.png' },
      { uri: 'file:///w/src/a.ts', name: 'a.ts', mention: { start: 4, end: 13, text: '@src/a.ts' } },
      { uri: 'file:///abs/b.md', name: 'b.md', mention: { start: 35, end: 45, text: '@/abs/b.md' } },
    ])
    expect(text.slice(4, 13)).toBe('@src/a.ts')
  })

  it('toPrompt: PDF and text documents go inline after the images', () => {
    const p = toPrompt(
      {
        text: 'read these',
        images: [],
        files: [
          { name: 'spec.pdf', mediaType: 'application/pdf', dataBase64: 'UERG' },
          { name: 'notes.md', mediaType: 'text/markdown', dataBase64: 'IyBh' },
        ],
      },
      '/w',
      exists,
    )
    expect(p.files?.map((f) => f.uri)).toEqual(['data:application/pdf;base64,UERG', 'data:text/markdown;base64,IyBh'])
  })

  it('toPrompt omits files when there are none', () => {
    expect(toPrompt({ text: 'hi', images: [] }, '/w', exists)).toEqual({ text: 'hi' })
  })

  it('parseSlash only for known commands', () => {
    expect(parseSlash('/review the diff', ['init', 'review'])).toEqual({ name: 'review', text: 'the diff' })
    expect(parseSlash('/init', ['init'])).toEqual({ name: 'init', text: '' })
    expect(parseSlash('/nope x', ['init'])).toBeNull()
    expect(parseSlash('say /init', ['init'])).toBeNull()
  })

  it.each([
    ['allow_once', 'once', 'allowed'],
    ['allow_always', 'always', 'allowed_always'],
    ['deny', 'reject', 'denied'],
  ] as const)('toDecision %s → %s → %s', (id, decision, outcome) => {
    expect(toDecision(id)).toBe(decision)
    expect(outcomeOf(decision)).toBe(outcome)
  })

  it.each([
    [['*'], ['allow_once', 'allow_always', 'deny']],
    [[], ['allow_once', 'deny']],
    [undefined, ['allow_once', 'deny']],
  ])('permissionOptions %j', (save, options) => expect(permissionOptions(save)).toEqual(options))
})

describe('options', () => {
  it('descriptors: model sorted, primary visible agents, effort only with variants', () => {
    const [, model, agent, effort] = buildOptionDescriptors(catalog, {})
    expect(model).toMatchObject({ key: 'model', default: 'fakeprov/fake-model', current: 'fakeprov/fake-model' })
    expect(model?.values?.map((v) => v.label)).toEqual(['Fake Model', 'Fake Small'])
    expect(agent).toMatchObject({ key: 'agent', labelKey: 'opencode:chat.option.agent', default: 'build' })
    expect(agent?.values?.map((v) => v.value)).toEqual(['build', 'plan'])
    expect(effort?.values?.map((v) => v.value)).toEqual([null, 'high', 'low'])
    const small = buildOptionDescriptors(catalog, { model: 'fakeprov/fake-small' })
    expect(small.map((d) => d.key)).toEqual(['permissionMode', 'model', 'agent'])
  })

  it('permission mode: ask (default) or auto-approve (dangerous, asks to confirm, excluded from nothing)', () => {
    const [permission] = buildOptionDescriptors(catalog, {})
    expect(permission).toMatchObject({ key: 'permissionMode', default: 'ask', current: 'ask' })
    expect(permission?.values?.map((v) => [v.value, v.tone, Boolean(v.requiresConfirm), Boolean(v.dangerous)])).toEqual(
      [
        ['ask', 'info', false, false],
        ['auto', 'warn', true, true],
      ],
    )
    const d = buildOptionDescriptors(catalog, {})
    expect(applyOption({}, 'permissionMode', 'auto', d)).toEqual({ permissionMode: 'auto' })
    expect(buildOptionDescriptors(catalog, { permissionMode: 'auto' })[0]?.current).toBe('auto')
    expect(() => applyOption({}, 'permissionMode', 'yolo', d)).toThrow('invalid option permissionMode')
  })

  it('applyOption validates and model change clears effort', () => {
    const d = buildOptionDescriptors(catalog, {})
    const withEffort = applyOption({}, 'effort', 'high', d)
    expect(withEffort).toEqual({ effort: 'high' })
    expect(modelInputOf({ ...withEffort, model: 'fakeprov/fake-model' })).toEqual({
      providerID: 'fakeprov',
      id: 'fake-model',
      variant: 'high',
    })
    expect(applyOption(withEffort, 'model', 'fakeprov/fake-small', d)).toEqual({
      effort: null,
      model: 'fakeprov/fake-small',
    })
    expect(applyOption({}, 'agent', 'plan', d)).toEqual({ agent: 'plan' })
    expect(() => applyOption({}, 'agent', 'title', d)).toThrow('invalid option agent')
    expect(() => applyOption({}, 'nope', 'x', d)).toThrow('invalid option nope')
  })

  it('model refs and context windows', () => {
    expect(modelRefOf('openrouter/anthropic/claude')).toEqual({ providerID: 'openrouter', id: 'anthropic/claude' })
    expect(modelInputOf({})).toBeUndefined()
    expect(contextWindowOf(models, { id: 'fake-model', providerID: 'fakeprov' })).toBe(10000)
    expect(contextWindowOf(models, { id: 'nope', providerID: 'fakeprov' })).toBeUndefined()
  })
})
