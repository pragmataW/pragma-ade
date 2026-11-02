import { describe, expect, it } from 'vitest'
import type { ChatUiDefinition } from '../../src/contract'
import { resolveChatUi } from '../../src/renderer/view/resolve-definition'

const fallback: ChatUiDefinition = { parts: {} }
const provider: ChatUiDefinition = { parts: {}, groupToolCalls: false }

describe('resolveChatUi', () => {
  it('resolveChatUi prefers provider definition, falls back to default', () => {
    expect(resolveChatUi('p', () => provider, fallback)).toBe(provider)
    expect(resolveChatUi('p', () => undefined, fallback)).toBe(fallback)
  })
})
