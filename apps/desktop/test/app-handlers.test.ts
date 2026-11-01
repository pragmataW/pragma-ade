import { CoreIpc } from '@pragma/sdk'
import { createMemoryTransport, IpcRouter, type MainHost } from '@pragma/sdk/runtime/main'
import { memoryLogger } from '@pragma/test-support'
import { expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: () => '1.0.0', isPackaged: false, relaunch: vi.fn(), exit: vi.fn() } }))
const { registerShellHandlers } = await import('../src/main/app-handlers')

it.each([
  [true, true],
  [false, false],
])('core.test.dialogStubs.set registered=%s when testMode=%s', (testMode, registered) => {
  const log = memoryLogger()
  const router = new IpcRouter(createMemoryTransport().transport, log)
  const host = { router, log, i18n: { languages: ['en'] } } as unknown as MainHost
  registerShellHandlers(host, { testMode, setDialogStubs: () => {} })
  expect(router.has(CoreIpc.testDialogStubsSet.channel)).toBe(registered)
  expect(router.has(CoreIpc.appInfo.channel)).toBe(true)
})
