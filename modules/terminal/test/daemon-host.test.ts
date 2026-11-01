import type { PtyInfo } from '@pragma/terminal-pty-daemon/protocol'
import { afterEach, expect, test } from 'vitest'
import { DaemonRequestError } from '../src/main/daemon-host'
import { shSpec, spec } from './support/factories'
import { stopHosts, testHost } from './support/host'
import { isAlive, waitFor } from './support/process'

afterEach(() => stopHosts())

const FAST = { restartDelaysMs: [20] }

test('start resolves on ready and exposes pid', async () => {
  const { host } = await testHost()
  await host.start()
  expect(isAlive(host.pid)).toBe(true)
})

test('requests issued before ready are queued', async () => {
  const { host } = await testHost()
  const started = host.start()
  const list = host.request<PtyInfo[]>({ type: 'list' })
  await started
  expect(await list).toEqual([])
})

test('error response rejects with DaemonRequestError code', async () => {
  const { host } = await testHost()
  await host.start()
  const error = await host.request({ type: 'spawn', spec: spec({ cwd: '/nonexistent/x' }) }).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(DaemonRequestError)
  expect(error).toMatchObject({ code: 'CWD_NOT_FOUND' })
})

test('SIGKILL → onCrash, pending reject, restart with a new pid, requests work again', async () => {
  const { host } = await testHost(FAST)
  await host.start()
  const crashes: unknown[] = []
  let restarts = 0
  host.onCrash((c) => crashes.push(c))
  host.onRestart(() => restarts++)
  const info = await host.request<PtyInfo>({ type: 'spawn', spec: shSpec("trap '' TERM; sleep 30") })
  const pending = host.request({ type: 'kill', ptyId: info.ptyId }) // waits for SIGKILL escalation
  const oldPid = host.pid
  process.kill(oldPid as number, 'SIGKILL')
  const error = await pending.catch((e) => e)
  expect(error).toMatchObject({ code: 'INTERNAL' })
  await waitFor(() => restarts === 1)
  expect(crashes).toEqual([{ code: null, signal: 'SIGKILL' }])
  expect(host.pid).not.toBe(oldPid)
  expect(await host.request({ type: 'list' })).toEqual([])
})

test('gives up after maxRestartsPerMinute', async () => {
  const { host, log } = await testHost({ ...FAST, maxRestartsPerMinute: 2 })
  await host.start()
  let restarts = 0
  host.onRestart(() => restarts++)
  for (let i = 0; i < 2; i++) {
    process.kill(host.pid as number, 'SIGKILL')
    await waitFor(() => restarts === i + 1)
  }
  process.kill(host.pid as number, 'SIGKILL')
  await waitFor(() => log.messages('error').some((m) => m.includes('giving up')))
  await expect(host.request({ type: 'list' })).rejects.toMatchObject({ code: 'INTERNAL' })
})

test('shutdown kills daemon and ptys without onCrash', async () => {
  const { host } = await testHost()
  await host.start()
  let crashes = 0
  host.onCrash(() => crashes++)
  const info = await host.request<PtyInfo>({ type: 'spawn', spec: shSpec('exec sleep 30') })
  const pid = host.pid
  await host.shutdown()
  expect(isAlive(pid)).toBe(false)
  await waitFor(() => !isAlive(info.pid), 3000)
  expect(crashes).toBe(0)
})
