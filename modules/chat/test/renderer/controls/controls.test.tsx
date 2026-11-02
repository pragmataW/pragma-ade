import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent, type ChatOptionDescriptor, type UsageEvent } from '../../../src/contract'
import { ContextMeterView } from '../../../src/renderer/kit/controls/ContextMeter'
import { ModelPicker } from '../../../src/renderer/kit/controls/ModelPicker'
import { createOptionPicker } from '../../../src/renderer/kit/controls/OptionPicker'
import { StopButton } from '../../../src/renderer/kit/controls/StopButton'
import { UsageMeter } from '../../../src/renderer/kit/controls/UsageMeter'
import { ChatSessionView } from '../../../src/renderer/view/ChatView'
import { callsOf, makeSession, makeTranscript, stubChatHost, stubSessionApi } from '../../../testing'
import { renderChat } from '../support'

const modeOption: ChatOptionDescriptor = {
  key: 'permissionMode',
  type: 'enum',
  labelKey: 'chat:option.permissionMode',
  values: [
    { value: 'default', label: 'Ask' },
    { value: 'bypassPermissions', label: 'Skip', warn: true },
  ],
  default: 'default',
  current: 'bypassPermissions',
}
const modelOption: ChatOptionDescriptor = {
  key: 'model',
  type: 'enum',
  labelKey: 'chat:option.model',
  values: [
    { value: null, labelKey: 'chat:option.model' },
    { value: 'opus', label: 'Opus 9' },
  ],
  default: null,
  current: 'opus',
}
const options = (...list: ChatOptionDescriptor[]): ChatEvent => ({ kind: 'options', options: list })
const usage = (extra: Partial<UsageEvent> = {}): UsageEvent => ({
  kind: 'usage',
  inputTokens: 12_300,
  outputTokens: 450,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  ...extra,
})
const PermissionPicker = createOptionPicker({ key: 'permissionMode' })

describe('controls', () => {
  it('createOptionPicker renders nothing without descriptor; enum calls setOption; warn value styled warn', async () => {
    const empty = stubSessionApi([])
    const { unmount } = renderChat(<PermissionPicker session={empty.api} />)
    expect(screen.queryByTestId(CHAT_TESTIDS.optionPicker('permissionMode'))).toBeNull()
    unmount()
    const s = stubSessionApi([options(modeOption)])
    renderChat(<PermissionPicker session={s.api} />)
    const trigger = screen.getByTestId(CHAT_TESTIDS.optionPicker('permissionMode'))
    expect(trigger).toHaveClass('text-warn')
    await userEvent.click(trigger)
    await userEvent.click(await screen.findByTestId(CHAT_TESTIDS.optionValue('permissionMode', 'default')))
    expect(s.callsOf('setOption')[0]?.args).toEqual(['permissionMode', 'default'])
  })

  it('ModelPicker shows literal model labels', async () => {
    const s = stubSessionApi([options(modelOption)])
    renderChat(<ModelPicker session={s.api} />)
    expect(screen.getByTestId(CHAT_TESTIDS.optionPicker('model'))).toHaveTextContent('Opus 9')
  })

  it('StopButton and Esc call interrupt while working', async () => {
    const working = stubSessionApi([{ kind: 'turn-start', turnId: 't' }], { status: 'working' })
    const { unmount } = renderChat(<StopButton session={working.api} />)
    await userEvent.click(screen.getByTestId(CHAT_TESTIDS.stop))
    expect(working.callsOf('interrupt')).toHaveLength(1)
    unmount()
    const host = stubChatHost()
    host.snapshots.set('s1', {
      providerId: 'fake',
      transcript: makeTranscript([{ kind: 'turn-start', turnId: 't' }]),
      status: 'working',
    })
    const view = renderChat(<ChatSessionView session={makeSession()} active />, host)
    await userEvent.click(await screen.findByTestId(CHAT_TESTIDS.composerInput))
    await userEvent.keyboard('{Escape}')
    expect(callsOf(host, 'interrupt')).toHaveLength(1)
    view.unmount()
    const idle = stubSessionApi([])
    renderChat(<StopButton session={idle.api} />)
    expect(screen.queryAllByTestId(CHAT_TESTIDS.stop)).toHaveLength(0)
  })

  it('ContextMeter percent and hidden when unknown', () => {
    const { unmount } = renderChat(
      <ContextMeterView usage={usage({ contextTokens: 170_000, contextWindow: 200_000 })} variant="text" />,
    )
    const meter = screen.getByTestId(CHAT_TESTIDS.context)
    expect(meter).toHaveTextContent('Context 85%')
    expect(meter).toHaveClass('text-warn')
    unmount()
    renderChat(<ContextMeterView usage={usage()} />)
    expect(screen.queryByTestId(CHAT_TESTIDS.context)).toBeNull()
  })

  it('UsageMeter shows compact tokens and cost', () => {
    const s = stubSessionApi([usage({ costUsd: 0.0123 })])
    renderChat(<UsageMeter session={s.api} />)
    expect(screen.getByTestId(CHAT_TESTIDS.usage)).toHaveTextContent('12.3K in · 450 out')
    expect(screen.getByTestId(CHAT_TESTIDS.usage)).toHaveTextContent('$0.0123')
  })
})
