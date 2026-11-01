import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { expect, test } from 'vitest'
import { ELECTRON_FUSES } from '../fuses'

const electronBinary = createRequire(import.meta.url)('electron') as unknown as string

test('Electron runs as Node 24 with ELECTRON_RUN_AS_NODE (runAsNode fuse stays on)', () => {
  const result = spawnSync(electronBinary, ['-e', 'process.stdout.write(process.versions.node)'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
  })
  expect(result.stdout).toMatch(/^24\./)
  expect(ELECTRON_FUSES.runAsNode).toBe(true)
  expect(ELECTRON_FUSES.enableNodeCliInspectArguments).toBe(true)
})
