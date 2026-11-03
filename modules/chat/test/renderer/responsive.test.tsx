import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent, type ChatOptionDescriptor } from '../../src/contract'
import type { ChatLayoutApi } from '../../src/renderer/kit/chat-layout'
import { ModelPicker } from '../../src/renderer/kit/controls/ModelPicker'
import { StopButton } from '../../src/renderer/kit/controls/StopButton'
import { AssistantText } from '../../src/renderer/kit/parts/AssistantText'
import { WorkingLine } from '../../src/renderer/kit/parts/WorkingLine'
import { CHAT_RESPONSIVE } from '../../src/renderer/kit/responsive'
import { placement } from '../../src/renderer/kit/tasks/TasksPanel'
import { ChatSessionView } from '../../src/renderer/view/ChatView'
import { makeSession, makeTranscript, stubChatHost, stubSessionApi } from '../../testing'
import { text } from './parts/samples'
import { renderChat, renderPart } from './support'

const WORKING: ChatEvent = { kind: 'turn-start', turnId: 't' }
const model: ChatOptionDescriptor = {
  key: 'model',
  type: 'enum',
  labelKey: 'chat:option.model',
  values: [{ value: 'opus', label: 'A very long model name 1M context' }],
  default: 'opus',
  current: 'opus',
}
const layout = (bodyWidth: number): ChatLayoutApi => ({
  revealItem: () => false,
  overlayHost: document.body,
  bodyWidth,
})

function renderView(status: 'working' | 'idle') {
  const host = stubChatHost()
  host.snapshots.set('s1', { providerId: 'fake', transcript: makeTranscript([WORKING]), status })
  return renderChat(<ChatSessionView session={makeSession()} active />, host)
}

describe('chat view at narrow widths (container queries)', () => {
  it('is a size container, so the kit adapts to the chat width, not the window', async () => {
    const { container } = renderView('idle')
    await screen.findByTestId(CHAT_TESTIDS.composerInput)
    expect(container.querySelector('[class*="@container/chat"]')).not.toBeNull()
  })

  it.each([
    ['Send', CHAT_TESTIDS.send],
    ['Stop', CHAT_TESTIDS.stop],
  ])('%s collapses to an icon but keeps its accessible name and tooltip', async (name, testId) => {
    renderView('working')
    const button = await screen.findByTestId(testId)
    expect(button).toHaveAccessibleName(name)
    expect(button).toHaveAttribute('title', name)
    expect(button.querySelector(`span[class~="${CHAT_RESPONSIVE.label}"]`)).toHaveTextContent(name)
  })

  it('a long model name truncates sooner and gives way to the model icon', () => {
    const s = stubSessionApi([{ kind: 'options', options: [model] }])
    renderChat(<ModelPicker session={s.api} />)
    const trigger = screen.getByTestId(CHAT_TESTIDS.optionPicker('model'))
    expect(trigger.querySelector('svg')).not.toBeNull()
    const label = screen.getByText(model.values?.[0]?.label ?? '')
    for (const cls of [...CHAT_RESPONSIVE.compactLabel.split(' '), CHAT_RESPONSIVE.label])
      expect(label).toHaveClass(cls)
  })

  it('the stop button is never squeezed by long pickers', () => {
    const s = stubSessionApi([WORKING], { status: 'working' })
    renderChat(<StopButton session={s.api} />)
    expect(screen.getByTestId(CHAT_TESTIDS.stop)).toHaveClass('shrink-0')
  })

  it.each([
    [400, 400],
    [540, 540],
    [700, 360],
  ])('the Tasks panel overlays a %ipx chat at %ipx', (body, width) => {
    expect(placement(layout(body), 360)).toEqual({ overlay: true, width })
  })
})

describe('no layout shift', () => {
  it('the working line overlays the transcript instead of pushing the composer', async () => {
    renderView('working')
    const line = await screen.findByTestId(CHAT_TESTIDS.workingLine)
    expect(line.parentElement).toHaveClass('absolute', 'bottom-full')
  })

  it('elapsed time uses tabular digits', () => {
    const s = stubSessionApi([WORKING], { status: 'working' })
    renderChat(<WorkingLine session={s.api} />)
    expect(screen.getByTestId(CHAT_TESTIDS.workingLine).lastElementChild).toHaveClass('tabular-nums')
  })

  it('a message keeps one footer row from streaming to done (caret, then copy)', () => {
    const { container } = renderPart(AssistantText, [text('p1', 'Hello')])
    const footer = container.querySelector('[data-testid] > div.h-6')
    expect(footer).not.toBeNull()
    expect(footer?.querySelector(`[data-testid="${CHAT_TESTIDS.copyMessage}"]`)).not.toBeNull()
  })
})
