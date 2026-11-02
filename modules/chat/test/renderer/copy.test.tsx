import { screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CHAT_TESTIDS, type ChatEvent, type ChatItem, type ChatPartProps } from '../../src/contract'
import { AssistantText } from '../../src/renderer/kit/parts/AssistantText'
import { UserMessage } from '../../src/renderer/kit/parts/UserMessage'
import { stubSessionApi } from '../../testing'
import { text, user } from './parts/samples'
import { renderChat } from './support'

vi.mock('@pragma/ui/components/copy-button', () => ({
  CopyButton: ({ text: value, label }: { text: string; label: string }) => (
    <button type="button" aria-label={label} data-text={value} />
  ),
}))

const CODE = 'const a = 1\n  return a'
const MD = `Intro **bold**\n\n\`\`\`ts\n${CODE}\n\`\`\`\n\nAfter`

function renderPart(Part: ComponentType<ChatPartProps<never>>, events: ChatEvent[]) {
  const s = stubSessionApi(events)
  const P = Part as ComponentType<ChatPartProps<ChatItem>>
  renderChat(<P item={s.api.transcript.items[0] as ChatItem} session={s.api} />)
}
const copied = (testId: string) =>
  screen.getAllByTestId(testId).map((el) => el.querySelector('button')?.getAttribute('data-text'))

describe('chat copy (11c)', () => {
  it('code copy passes exact code to CopyButton', () => {
    renderPart(AssistantText, [text('p1', MD)])
    expect(copied(CHAT_TESTIDS.copyCode)).toEqual([CODE])
    expect(screen.getByText('After')).toBeInTheDocument()
  })

  it('message copy passes raw markdown', () => {
    renderPart(AssistantText, [text('p1', MD)])
    expect(copied(CHAT_TESTIDS.copyMessage)).toEqual([MD])
  })

  it('user message copy passes the text', () => {
    renderPart(UserMessage, [user('u1', 'line one\nline two')])
    expect(copied(CHAT_TESTIDS.copyMessage)).toEqual(['line one\nline two'])
  })
})
