import { createTestModuleHost } from '@pragma/test-support'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { defineRendererCapability } from '../src/common/providers'
import { defineMainModule } from '../src/main/types'
import { defineRendererModule, type RendererContext } from '../src/renderer/types'
import { useLatestAsync } from '../src/renderer/use-latest-async'
import { createRendererHost } from '../src/runtime/renderer/renderer-host'
import type { RendererModuleRecord } from '../src/runtime/renderer/types'
import { featureRecord, manifest, providerRecord } from './lib/builders'

declare module '../src/common/providers' {
  interface RendererCapabilityMap {
    hostBadge: { label: string }
  }
}

const settingsSection = { schema: z.object({ greeting: z.string() }), defaults: { greeting: 'hello' } }

function rendererRecord(
  id: string,
  activate: (ctx: RendererContext) => void,
  extra: Partial<RendererModuleRecord> = {},
) {
  return { id, manifest: manifest(id), locales: { en: {} }, renderer: defineRendererModule({ activate }), ...extra }
}

/** A renderer module that hands its context to the test. */
function captured(id: string) {
  const box: { ctx?: RendererContext } = {}
  const record = rendererRecord(id, (c) => {
    box.ctx = c
  })
  return { box, record }
}

async function boot(opts: {
  main?: Parameters<typeof createTestModuleHost>[0]['modules']
  renderer?: RendererModuleRecord[]
}) {
  const main = await createTestModuleHost({ modules: opts.main ?? [] })
  const host = await createRendererHost({
    records: opts.renderer ?? [],
    coreLocales: { en: { app: { title: 'T' } } },
    bridge: main.bridge,
    log: main.log,
  })
  return { main, host }
}

describe('renderer host', () => {
  test('activates only modules active in main, in order', async () => {
    const order: string[] = []
    const rec = (id: string) => rendererRecord(id, () => void order.push(id))
    await boot({
      main: [
        featureRecord('c', { manifest: { dependsOn: ['a'] } }),
        featureRecord('a'),
        featureRecord('b', { manifest: { dependsOn: ['zz'] } }),
      ],
      renderer: [rec('c'), rec('b'), rec('a')],
    })
    expect(order).toEqual(['a', 'c'])
  })
  test('settings.update round-trip', async () => {
    const { box, record } = captured('a')
    const { main } = await boot({
      main: [featureRecord('a', { main: defineMainModule({ settings: settingsSection, activate() {} }) })],
      renderer: [record],
    })
    expect(box.ctx?.settings.get()).toEqual({ greeting: 'hello' })
    await box.ctx?.settings.update({ greeting: 'hi' })
    expect(main.host.settings.get('a')).toEqual({ greeting: 'hi' })
    expect(box.ctx?.settings.get()).toEqual({ greeting: 'hi' })
  })
  test('renderer command executed from main', async () => {
    const { main } = await boot({
      main: [featureRecord('a')],
      renderer: [rendererRecord('a', (c) => void c.commands.register('a.double', (n) => (n as number) * 2))],
    })
    await waitFor(() => expect(main.host.commands.has('a.double')).toBe(true))
    expect(await main.host.commands.execute('a.double', 21)).toBe(42)
  })
  test('rendererCapability', async () => {
    const { host } = await boot({
      main: [providerRecord('p')],
      renderer: [
        {
          id: 'p',
          manifest: manifest('p', { kind: 'provider' }),
          locales: { en: {} },
          provider: {
            descriptor: { id: 'p', displayNameKey: 'p:provider.name', icon: 'p', defaultCommand: 'p', defaultArgs: [] },
            capabilities: [defineRendererCapability('p', 'hostBadge', { label: 'B' })],
          },
        },
      ],
    })
    expect(host.providers.rendererCapability('p', 'hostBadge')?.label).toBe('B')
  })
  test('ctx.theme updates on core.theme.changed', async () => {
    const { box, record } = captured('a')
    const { main } = await boot({ main: [featureRecord('a')], renderer: [record] })
    const seen = vi.fn()
    box.ctx?.theme.onChange(seen)
    main.host.theme.set({ mode: 'light', palette: 'indigo', density: 'compact' })
    expect(box.ctx?.theme.get()).toMatchObject({ resolved: 'light', palette: 'indigo' })
    expect(seen).toHaveBeenCalledOnce()
  })
  test('ctx.dialogs.openFolder reaches the fake platform; nativeViews.freeze reaches the host', async () => {
    const { box, record } = captured('a')
    const { main } = await boot({ main: [featureRecord('a')], renderer: [record] })
    await box.ctx?.dialogs.openFolder({})
    expect(main.platform.calls.map((c) => c.method)).toContain('dialogs.openFolder')
    const freeze = vi.spyOn(main.host.nativeViews, 'freeze').mockResolvedValue()
    await box.ctx?.nativeViews.freeze('v')
    expect(freeze).toHaveBeenCalledWith('v')
  })
  test('[i18n-missing] in test mode', async () => {
    const { host, main } = await boot({})
    host.i18n.t('core:nope.key')
    expect(main.log.messages('warn').some((m) => m.startsWith('[i18n-missing]'))).toBe(true)
  })
})

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Two pending calls; deps change from the first to the second before either settles. */
function switchedCalls() {
  const calls = [deferred<string>(), deferred<string>()]
  const hook = renderHook(({ dep }) => useLatestAsync(() => calls[dep]?.promise as Promise<string>, [dep]), {
    initialProps: { dep: 0 },
  })
  hook.rerender({ dep: 1 })
  return { calls, result: hook.result }
}

describe('useLatestAsync', () => {
  test('slow first call resolving after fast second call is ignored', async () => {
    const { calls, result } = switchedCalls()
    await act(async () => calls[1]?.resolve('fast'))
    await act(async () => calls[0]?.resolve('slow'))
    expect(result.current.data).toBe('fast')
  })
  test('previous signal is aborted on deps change; unmount aborts', async () => {
    const signals: AbortSignal[] = []
    const { rerender, unmount } = renderHook(
      ({ dep }) =>
        useLatestAsync(
          (s) => {
            signals.push(s)
            return new Promise(() => {})
          },
          [dep],
        ),
      {
        initialProps: { dep: 0 },
      },
    )
    rerender({ dep: 1 })
    expect(signals[0]?.aborted).toBe(true)
    unmount()
    expect(signals[1]?.aborted).toBe(true)
  })
  test('reload re-runs', async () => {
    let n = 0
    const { result } = renderHook(() => useLatestAsync(async () => ++n, []))
    await waitFor(() => expect(result.current.data).toBe(1))
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.data).toBe(2))
  })
  test('errors of stale calls are dropped', async () => {
    const { calls, result } = switchedCalls()
    await act(async () => calls[0]?.reject(new Error('stale')))
    await act(async () => calls[1]?.resolve('ok'))
    expect(result.current).toMatchObject({ data: 'ok', error: undefined, loading: false })
  })
})
