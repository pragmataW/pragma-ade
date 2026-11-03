import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { makeLaunchContext } from '@pragma/module-agents/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LAUNCH_DECORATOR_ID } from '../src/constants'
import { type AskCapability, cliIntegrationIpc, SKILL_IDS } from '../src/contract'
import { FAKE_ASK_ENV, type FakeAskRecord, writeFakeAskBin } from '../testing'
import { aWorktree } from './support/fakes'
import { activateModule } from './support/module-ctx'
import { makeSkillsFixture } from './support/skills'

afterEach(() => {
  vi.unstubAllEnvs()
})

/** Posts one bridge message to the module (`m`, else a freshly activated one). */
async function postCli(type: string, payload: unknown, m?: Awaited<ReturnType<typeof activateModule>>) {
  const { bridge } = m ?? (await activateModule())
  return fetch(`${bridge.url}/hook`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bridge.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  })
}

describe('cli-integration main module', () => {
  it('writes the shim and registers the PATH decorator', async () => {
    const m = await activateModule()
    const shim = join(m.userData, 'modules', 'cli-integration', 'bin', 'pragma')
    expect(existsSync(shim)).toBe(true)
    expect(readFileSync(shim, 'utf8')).toContain('ELECTRON_RUN_AS_NODE=1 exec')
    expect(m.agents.state.decorators.map((d) => d.id)).toEqual([LAUNCH_DECORATOR_ID])
    const spec = await m.agents.state.decorators[0]?.decorate(
      { command: 'a', args: [], env: {}, cwd: '/w' },
      makeLaunchContext({ env: {}, shellEnv: { PATH: '/usr/bin' } }),
    )
    expect(spec?.env.PATH).toBe(`${join(m.userData, 'modules', 'cli-integration', 'bin')}:/usr/bin`)
  })

  it('serves cli.* on the bridge', async () => {
    const res = await postCli('cli.profileList', { context: { cwd: '/' } })
    expect(await res.json()).toMatchObject({
      payload: { ok: true, result: { profiles: [{ id: 'claude' }, { id: 'oc' }] } },
    })
  })

  it('serves cli.askWait (unknown ids are not found)', async () => {
    const res = await postCli('cli.askWait', { context: { cwd: '/' }, askId: 'gone' })
    expect(await res.json()).toMatchObject({ payload: { ok: false, error: { code: 'not_found' } } })
  })

  it.skipIf(process.platform === 'win32')(
    "serves cli.ask: the provider's ask capability answers, run in the caller's worktree",
    async () => {
      let bin = ''
      const record = () => join(dirname(bin), 'record.json')
      const ask: AskCapability = {
        buildAsk: async (q) => ({
          command: bin,
          args: [],
          env: { PATH: process.env.PATH ?? '', [FAKE_ASK_ENV.stdout]: '42', [FAKE_ASK_ENV.record]: record() },
          stdin: q.prompt,
        }),
        parseAnswer: (out) => (out.exitCode === 0 ? { ok: true, text: out.stdout } : { ok: false, message: 'x' }),
      }
      const m = await activateModule({ askProviders: [{ id: 'prov', ask }] })
      const wt = realpathSync(m.root)
      bin = await writeFakeAskBin(wt)
      m.projects.state.worktrees = [aWorktree('w1', { path: wt })]
      const res = await postCli('cli.ask', { context: { cwd: '/', worktreeId: 'w1' }, to: 'claude', prompt: 'q?' }, m)
      expect(await res.json()).toMatchObject({
        payload: { ok: true, result: { status: 'answered', text: '42', profile: { id: 'claude' } } },
      })
      const rec = JSON.parse(readFileSync(record(), 'utf8')) as FakeAskRecord
      expect(rec.cwd).toBe(wt)
      expect(rec.stdin).toContain('<question>\nq?\n</question>')
    },
  )

  it('deactivate unregisters the decorator', async () => {
    const m = await activateModule()
    const { default: mainModule } = await import('../src/main')
    await mainModule.deactivate?.()
    expect(m.agents.state.decorators).toEqual([])
  })
})

describe('settings IPC', () => {
  it('getStatus reports the CLI under <home>/.local/bin as not installed', async () => {
    vi.stubEnv('HOME', mkdtempSync(join(tmpdir(), 'pragma-cli-home-')))
    const m = await activateModule()
    const status = await m.fake.invoke(cliIntegrationIpc.getStatus, undefined)
    expect(status.cli).toMatchObject({ state: 'not_installed', bundleFound: true })
    expect(status.cli.linkPath.endsWith(join('.local', 'bin', 'pragma'))).toBe(true)
  })
})

describe('skills IPC', () => {
  it('lists missing targets, installs only the chosen provider and publishes the new status', async () => {
    const f = makeSkillsFixture()
    vi.stubEnv('HOME', f.home)
    const m = await activateModule({ skillProviders: f.providers })
    const before = await m.fake.invoke(cliIntegrationIpc.getStatus, undefined)
    const perProvider = SKILL_IDS.length
    expect(before.skills.map((s) => [s.providerId, s.state])).toEqual([
      ...Array.from({ length: perProvider }, () => ['alpha', 'missing']),
      ...Array.from({ length: perProvider }, () => ['beta', 'missing']),
    ])
    const after = await m.fake.invoke(cliIntegrationIpc.installSkills, { providerIds: ['alpha'] })
    expect(after.skills.map((s) => s.state)).toEqual([
      ...Array.from({ length: perProvider }, () => 'current'),
      ...Array.from({ length: perProvider }, () => 'missing'),
    ])
    expect(existsSync(join(f.home, '.alpha', 'skills', 'pragma-handoff', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(m.userData, 'modules', 'cli-integration', 'installed-skills.json'))).toBe(true)
    expect(m.fake.publishedOn(cliIntegrationIpc.statusChanged)).toEqual([after])
    vi.unstubAllEnvs()
  })
})
