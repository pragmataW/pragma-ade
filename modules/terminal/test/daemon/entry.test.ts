import { type ChildProcess, fork } from 'node:child_process'
import { afterEach, expect, test } from 'vitest'
import type { DaemonMessage, PtyInfo } from '../../packages/pty-daemon/src/protocol'
import { builtDaemon, daemonEnv } from '../support/daemon-bundle'
import { shSpec } from '../support/factories'
import { isAlive, waitFor } from '../support/process'

const children: ChildProcess[] = []
afterEach(() => {
  for (const c of children.splice(0)) c.kill('SIGKILL')
})

async function forkDaemon() {
  const child = fork(await builtDaemon(), [], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], env: daemonEnv() })
  children.push(child)
  const messages: DaemonMessage[] = []
  child.on('message', (m) => messages.push(m as DaemonMessage))
  return { child, messages }
}

test('forked daemon announces ready and runs a pty', async () => {
  const { child, messages } = await forkDaemon()
  await waitFor(() => messages.find((m) => m.kind === 'ready'), 10_000)
  child.send({ id: 1, type: 'spawn', spec: shSpec('printf bundled-ok') })
  await waitFor(() => messages.some((m) => m.kind === 'data' && m.data.includes('bundled-ok')), 5000)
}, 20_000)

test('daemon exits and kills its ptys when the parent disconnects', async () => {
  const { child, messages } = await forkDaemon()
  await waitFor(() => messages.find((m) => m.kind === 'ready'), 10_000)
  child.send({ id: 1, type: 'spawn', spec: shSpec('exec sleep 30') })
  const res = await waitFor(() => messages.find((m) => m.kind === 'response' && m.id === 1))
  const info = (res as { result: PtyInfo }).result
  const exited = new Promise<number | null>((resolve) => child.once('exit', resolve))
  child.disconnect()
  expect(await exited).toBe(0)
  await waitFor(() => !isAlive(info.pid), 3000)
}, 20_000)
