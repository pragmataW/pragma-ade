import { defineIpc, z } from '@pragma/sdk'
import { defineTestHooks } from '@pragma/sdk/main'
import { EDITOR_OPEN_FILE_COMMAND, FAKE_EDITOR_ENV } from '../constants'

const ENABLED = '1'
/** Test-only IPC (not part of the contract): every `editor.openFile` call the fake editor recorded. */
export const editorCallsIpc = defineIpc({
  channel: 'git-changes.test.editorCalls',
  input: z.unknown(),
  output: z.array(z.unknown()),
})

/** Under `PRAGMA_TEST=1` with `PRAGMA_TEST_FAKE_EDITOR=1` and no editor module: a recording `editor.openFile`. */
export default defineTestHooks((ctx) => {
  if (process.env[FAKE_EDITOR_ENV] !== ENABLED || ctx.commands.has(EDITOR_OPEN_FILE_COMMAND)) return
  const calls: unknown[] = []
  ctx.commands.register(EDITOR_OPEN_FILE_COMMAND, (args) => {
    calls.push(args)
  })
  ctx.ipc.handle(editorCallsIpc, () => [...calls])
})
