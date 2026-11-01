import { agentSessionStatuses } from '@pragma/module-agents/contract'
import { joinBridgeType } from '@pragma/module-bridge/contract'
import type { CapabilityMap } from '@pragma/sdk'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  AGENT_HOOK_TYPE,
  AGENT_STATUS_TEST_IDS,
  AgentStatusEventSchema,
  AgentStatusSchema,
  AgentStatusSettingsSchema,
  agentStatusSettingsDefaults,
  STATUS_EVENT_KINDS,
  type StatusCapability,
} from '../src/contract'

const sample: Record<(typeof STATUS_EVENT_KINDS)[number], Record<string, unknown>> = {
  sessionStarted: {},
  promptSubmitted: { externalSessionId: 'x' },
  toolStarted: { toolName: 'Bash' },
  toolFinished: {},
  waitingForUser: { reason: 'permission' },
  userResponded: {},
  turnCompleted: {},
  turnInterrupted: {},
  turnFailed: { message: 'boom' },
  sessionEnded: {},
}

describe('agent-status contract', () => {
  it('event kinds equal STATUS_EVENT_KINDS', () => {
    const kinds = AgentStatusEventSchema.options.map((o) => o.shape.kind.value)
    expect(kinds).toEqual([...STATUS_EVENT_KINDS])
  })

  it.each(STATUS_EVENT_KINDS)('%s parses', (kind) => {
    expect(AgentStatusEventSchema.safeParse({ kind, ...sample[kind] }).success).toBe(true)
  })

  it.each([{ kind: 'nope' }, { kind: 'waitingForUser' }, { kind: 'toolStarted', toolName: 'x'.repeat(201) }])(
    'rejects %j',
    (event) => {
      expect(AgentStatusEventSchema.safeParse(event).success).toBe(false)
    },
  )

  it('AgentStatusSchema options equal agentSessionStatuses', () => {
    expect(AgentStatusSchema.options).toEqual([...agentSessionStatuses])
  })

  it('defaults satisfy the settings schema', () => {
    expect(AgentStatusSettingsSchema.parse(agentStatusSettingsDefaults)).toEqual(agentStatusSettingsDefaults)
  })

  it('AGENT_HOOK_TYPE is agent.hookEvent', () => {
    expect(AGENT_HOOK_TYPE).toBe(joinBridgeType('agent', 'hookEvent'))
  })

  it('test ids are unique', () => {
    const ids = Object.values(AGENT_STATUS_TEST_IDS)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('CapabilityMap has status', () => {
    expectTypeOf<CapabilityMap['status']>().toEqualTypeOf<StatusCapability>()
  })
})
