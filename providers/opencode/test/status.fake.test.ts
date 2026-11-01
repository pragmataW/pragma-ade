import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { spawnFake, startRecordingAgentBridge } from '@pragma/module-agent-status/testing'
import { describe, expect, it } from 'vitest'
import { mergeOpencodeConfigContent } from '../src/main/status/config-content'
import { fakeOpencodeHooksPath } from '../testing/fake-opencode-hooks'

const HOOKS_PKG = join(import.meta.dirname, '..', 'packages', 'hooks')

describe('fake-opencode-hooks', () => {
  it('requires --standalone (exit 2)', async () => {
    expect(await spawnFake(fakeOpencodeHooksPath).exited).toBe(2)
  })

  it('loads a 2.x plugin dir and delivers oc events', async () => {
    expect(spawnSync(process.execPath, ['build.mjs'], { cwd: HOOKS_PKG }).status).toBe(0)
    const bridge = await startRecordingAgentBridge()
    try {
      const fake = spawnFake(fakeOpencodeHooksPath, ['--standalone'], {
        OPENCODE_CONFIG_CONTENT: mergeOpencodeConfigContent(undefined, join(HOOKS_PKG, 'dist', 'plugin')),
        ...bridge.env('ps-oc'),
      })
      await fake.waitForOutput('ready')
      fake.send('oc session.execution.started {"sessionID":"ses_1"}')
      await fake.waitForOutput('event session.execution.started')
      fake.send('exit')
      await fake.exited
      expect(bridge.types()).toEqual(['pragma.ready', 'session.execution.started'])
      expect(bridge.received[1]).toMatchObject({
        sessionId: 'ps-oc',
        providerId: 'opencode',
        event: { sessionID: 'ses_1' },
      })
    } finally {
      await bridge.server.close()
    }
  })
})
