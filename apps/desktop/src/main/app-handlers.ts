import { CoreIpc, type DialogStubs, DialogStubsSchema, TEST_DIALOG_STUBS_ENV } from '@pragma/sdk'
import { type MainHost, registerAppHandlers } from '@pragma/sdk/runtime/main'
import { app } from 'electron'

export function initialDialogStubs(env: Record<string, string | undefined>): DialogStubs {
  const raw = env[TEST_DIALOG_STUBS_ENV]
  return raw ? DialogStubsSchema.parse(JSON.parse(raw)) : {}
}

/** `core.app.*` plus, in test mode only, `core.test.dialogStubs.set`. */
export function registerShellHandlers(
  host: MainHost,
  opts: { testMode: boolean; setDialogStubs(s: DialogStubs): void },
): void {
  registerAppHandlers(host, {
    info: { version: app.getVersion(), platform: process.platform, testMode: opts.testMode, packaged: app.isPackaged },
    relaunch: () => {
      app.relaunch()
      app.exit(0)
    },
  })
  if (opts.testMode) host.router.handle(CoreIpc.testDialogStubsSet, (s) => opts.setDialogStubs(s))
}
