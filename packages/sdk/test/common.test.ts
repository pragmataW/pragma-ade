import { afterEach, describe, expect, it, test, vi } from 'vitest'
import {
  type CapabilityContext,
  createServiceToken,
  debounce,
  deepMerge,
  defaultUserDataDirs,
  defineCapability,
  defineIpc,
  type ElectronInputLike,
  type KeyboardEventLike,
  ModuleManifestSchema,
  matchShortcut,
  parseAccelerator,
  RingBuffer,
  ShellTestIds,
  SubPackageManifestSchema,
  slugify,
  throttle,
  z,
} from '../src/index'

declare module '../src/common/providers' {
  interface CapabilityMap {
    commonTestCap: { hello(): string }
  }
}

const base = { id: 'demo', kind: 'feature', displayNameKey: 'demo:module.name' }

describe('manifest', () => {
  test('manifest defaults and id rules', () => {
    const m = ModuleManifestSchema.parse({
      ...base,
      build: 'build',
      package: { extraResources: [{ from: 'a', to: 'b' }] },
    })
    expect(m).toMatchObject({ dependsOn: [], optionalDependsOn: [], core: false, build: 'build' })
    expect(m.package?.extraResources).toEqual([{ from: 'a', to: 'b' }])
    expect(ModuleManifestSchema.parse(base).package).toBeUndefined()
    for (const id of ['Bad', 'core', '1x', 'a_b'])
      expect(ModuleManifestSchema.safeParse({ ...base, id }).success).toBe(false)
    expect(ModuleManifestSchema.safeParse({ ...base, extra: 1 }).success).toBe(false)
  })
  test('sub-package manifest accepts only build/package', () => {
    expect(SubPackageManifestSchema.parse({ build: 'build', package: { extraResources: [] } })).toEqual({
      build: 'build',
      package: { extraResources: [] },
    })
    expect(SubPackageManifestSchema.safeParse({ id: 'x' }).success).toBe(false)
  })
})

test('createServiceToken derives moduleId and rejects bare names', () => {
  expect(createServiceToken<number>('terminal.pty').moduleId).toBe('terminal')
  expect(createServiceToken<number>('core.theme').moduleId).toBe('core')
  expect(() => createServiceToken('pty')).toThrow()
})

test('deepMerge merges objects, replaces arrays, ignores undefined', () => {
  const merged = deepMerge({ a: { b: 1, c: [1, 2] }, d: 'x' }, { a: { c: [3] }, d: undefined })
  expect(merged).toEqual({ a: { b: 1, c: [3] }, d: 'x' })
})

it.each(['ping', 'Upper.x', '.x'])('defineIpc rejects channel %s', (channel) => {
  expect(() => defineIpc({ channel, input: z.void(), output: z.void() })).toThrow()
})

test('defineCapability accepts impl and factory and normalises to create()', () => {
  const capCtx = { log: {} } as unknown as CapabilityContext
  const impl = { hello: () => 'hi' }
  expect(defineCapability('p', 'commonTestCap', impl).create(capCtx)).toBe(impl)
  const factory = vi.fn(() => impl)
  const reg = defineCapability('p', 'commonTestCap', factory)
  expect(reg).toMatchObject({ kind: 'capability', side: 'main', providerId: 'p', key: 'commonTestCap' })
  expect(reg.create(capCtx)).toBe(impl)
  expect(factory).toHaveBeenCalledWith(capCtx)
})

describe('accelerators', () => {
  const electron = (e: Partial<ElectronInputLike>): ElectronInputLike => ({
    key: '',
    meta: false,
    control: false,
    shift: false,
    alt: false,
    ...e,
  })
  it.each([
    ['darwin', { meta: true, shift: true }, true],
    ['darwin', { control: true, shift: true }, false],
    ['linux', { control: true, shift: true }, true],
    ['linux', { meta: true, shift: true }, false],
  ])('CmdOrCtrl+Shift+P on %s with %o → %s', (platform, mods, expected) => {
    const input = electron({ key: 'P', code: 'KeyP', ...mods })
    expect(matchShortcut(input, 'CmdOrCtrl+Shift+P', platform)).toBe(expected)
    const dom: KeyboardEventLike = {
      key: 'P',
      code: 'KeyP',
      metaKey: input.meta,
      ctrlKey: input.control,
      shiftKey: input.shift,
      altKey: false,
    }
    expect(matchShortcut(dom, 'CmdOrCtrl+Shift+P', platform)).toBe(expected)
  })
  test('parseAccelerator normalises keys', () => {
    expect(parseAccelerator('CmdOrCtrl+,', 'darwin')).toEqual({
      key: ',',
      meta: true,
      control: false,
      shift: false,
      alt: false,
    })
    expect(parseAccelerator('Esc', 'linux').key).toBe('escape')
  })
})

describe('timing', () => {
  afterEach(() => vi.useRealTimers())
  test('debounce runs only the trailing call; flush and cancel work', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const d = debounce(fn, 100)
    d(1)
    d(2)
    vi.advanceTimersByTime(100)
    expect(fn.mock.calls).toEqual([[2]])
    d(3)
    d.flush()
    expect(fn).toHaveBeenLastCalledWith(3)
    d(4)
    d.cancel()
    vi.advanceTimersByTime(200)
    expect(fn).toHaveBeenCalledTimes(2)
  })
  test('throttle runs leading, then trailing with last args', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const t = throttle(fn, 100)
    t(1)
    t(2)
    t(3)
    expect(fn.mock.calls).toEqual([[1]])
    vi.advanceTimersByTime(100)
    expect(fn.mock.calls).toEqual([[1], [3]])
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('RingBuffer', () => {
  it.each([
    [1, [1, 2, 3], [3]],
    [3, [1, 2, 3, 4, 5], [3, 4, 5]],
  ])('capacity %i keeps the newest items in order', (capacity, pushes, expected) => {
    const rb = new RingBuffer<number>(capacity)
    for (const p of pushes) rb.push(p)
    expect(rb.toArray()).toEqual(expected)
    expect(rb.size).toBe(expected.length)
    rb.clear()
    expect(rb.toArray()).toEqual([])
  })
  test('capacity 0 throws', () => expect(() => new RingBuffer(0)).toThrow(RangeError))
})

it.each([
  ['darwin', {}, '/Users/u/Library/Application Support/Pragma ADE'],
  ['linux', {}, '/home/u/.config/Pragma ADE'],
  ['linux', { XDG_CONFIG_HOME: '/xdg' }, '/xdg/Pragma ADE'],
  ['win32', { APPDATA: 'C:\\AD' }, 'C:\\AD\\Pragma ADE'],
])('defaultUserDataDirs on %s %o', (platform, env, expected) => {
  const home = platform === 'darwin' ? '/Users/u' : '/home/u'
  expect(defaultUserDataDirs({ platform, home, env })).toEqual([expected])
})
test('defaultUserDataDirs puts the env override first', () => {
  expect(defaultUserDataDirs({ platform: 'darwin', home: '/h', env: { PRAGMA_USER_DATA: '/tmp/x' } })[0]).toBe('/tmp/x')
})

it.each([
  ['Fix Login Bug!', undefined, 'fix-login-bug'],
  ['Çalışma ağacı Şablonu', undefined, 'calisma-agaci-sablonu'],
  ['  --a__b--  ', undefined, 'a-b'],
  ['x'.repeat(60), undefined, 'x'.repeat(48)],
  ['abc def', { maxLength: 4 }, 'abc'],
  ['!!!', undefined, ''],
])('slugify(%j, %o) → %j', (input, opts, expected) => {
  expect(slugify(input, opts)).toBe(expected)
})

test('ShellTestIds builders are stable', () => {
  expect(ShellTestIds.rightTab('x')).toBe('right-tab-x')
  expect(ShellTestIds.nativeSnapshot('v')).toBe('native-snapshot-v')
  expect(ShellTestIds.settingsPage('general')).toBe(ShellTestIds.settingsPage('general'))
})
