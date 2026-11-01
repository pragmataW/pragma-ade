// Opt-in smoke check against the real `opencode` binary (no model call, no credentials, temp HOME/XDG):
//   PRAGMA_SMOKE_OPENCODE=1 pnpm exec vitest run providers/opencode/test/status-smoke.test.ts
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startRecordingAgentBridge } from '@pragma/module-agent-status/testing'
import { parseSemver } from '@pragma/module-agents/contract'
import { describe, expect, it } from 'vitest'
import { mergeOpencodeConfigContent } from '../src/main/status/config-content'

const ENABLED = process.env.PRAGMA_SMOKE_OPENCODE === '1'
const version = ENABLED ? parseSemver(spawnSync('opencode', ['--version'], { encoding: 'utf8' }).stdout ?? '') : null
const SUPPORTED = version !== null && (version[0] > 2 || (version[0] === 2 && version[1] >= 2))
const WAIT_MS = 40_000
const POLL_MS = 100
const waitFor = async (ok: () => boolean, ms: number): Promise<void> => {
  const deadline = Date.now() + ms
  while (!ok() && Date.now() < deadline) await new Promise((r) => setTimeout(r, POLL_MS))
}
const HOOKS_PKG = join(import.meta.dirname, '..', 'packages', 'hooks')

describe.runIf(ENABLED && SUPPORTED)('opencode status plugin smoke (real binary)', () => {
  it('bridge receives ready, inbox, execution started and failed', { timeout: 60_000 }, async () => {
    const build = spawnSync(process.execPath, ['build.mjs'], { cwd: HOOKS_PKG, encoding: 'utf8' })
    expect(build.status).toBe(0)
    const bridge = await startRecordingAgentBridge()
    const home = await mkdtemp(join(tmpdir(), 'pragma-oc-smoke-'))
    try {
      const env = {
        PATH: process.env.PATH ?? '',
        HOME: home,
        XDG_CONFIG_HOME: join(home, 'config'),
        XDG_DATA_HOME: join(home, 'data'),
        XDG_CACHE_HOME: join(home, 'cache'),
        XDG_STATE_HOME: join(home, 'state'),
        OPENCODE_CONFIG_CONTENT: mergeOpencodeConfigContent(undefined, join(HOOKS_PKG, 'dist', 'plugin')),
        ...bridge.env('smoke-1'),
      }
      const child = spawn('opencode', ['run', '--standalone', '--model', 'nonexistent/none', 'hi'], {
        env,
        cwd: home,
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      const types = bridge.types
      const closed = new Promise((resolve) => child.on('close', resolve))
      await Promise.race([closed, waitFor(() => types().includes('session.execution.failed'), WAIT_MS)])
      child.kill()
      await closed
      expect(types()).toEqual(
        expect.arrayContaining([
          'pragma.ready',
          'session.inbox.enqueued',
          'session.execution.started',
          'session.execution.failed',
        ]),
      )
    } finally {
      await bridge.server.close()
      await rm(home, { recursive: true, force: true })
    }
  })
})
