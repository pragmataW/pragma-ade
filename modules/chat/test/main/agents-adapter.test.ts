import type { AgentSessionsService } from '@pragma/module-agents/contract'
import { describe, expect, it, vi } from 'vitest'
import { createAgentsApiFrom } from '../../src/main/agents-adapter'

const agents = { buildLaunchEnv: vi.fn(async () => ({ PATH: '/x' })) } as unknown as AgentSessionsService
const deps = {
  agents,
  projects: { getWorktree: async () => ({ path: '/w' }) },
  git: { run: async () => ({ stdout: 'a.ts\nsrc/b.ts\n' }) },
  log: { warn: vi.fn() },
}

describe('createAgentsApiFrom', () => {
  it('reportStatus is a no-op without agent-status', () => {
    expect(() => createAgentsApiFrom(deps).reportStatus('s1', { kind: 'turnCompleted' })).not.toThrow()
  })

  it('reportStatus forwards to agent-status when present', () => {
    const reportEvent = vi.fn(async () => true)
    createAgentsApiFrom({ ...deps, agentStatus: { reportEvent } }).reportStatus('s1', { kind: 'turnCompleted' })
    expect(reportEvent).toHaveBeenCalledWith('s1', { kind: 'turnCompleted' })
  })

  it('buildLaunchEnv forwards {sessionId, resume} unchanged', async () => {
    const ctx = { sessionId: 's1', resume: { externalSessionId: 'ext' } }
    expect(await createAgentsApiFrom(deps).buildLaunchEnv(ctx)).toEqual({ PATH: '/x' })
    expect(agents.buildLaunchEnv).toHaveBeenCalledWith(ctx)
  })

  it('listWorktreeFiles splits git ls-files output', async () => {
    expect(await createAgentsApiFrom(deps).listWorktreeFiles('/w')).toEqual(['a.ts', 'src/b.ts'])
  })
})
