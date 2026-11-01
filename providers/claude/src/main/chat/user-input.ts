// MIT License — Copyright (c) 2026 Lovecast Inc. (stablyai/orca)
// Derived from orca src/main/claude/claude-agent-sdk-user-message-queue.ts.
// Modified for Pragma ADE: simplified (no per-frame write confirmation or dispatch hooks); `push` is fire-and-forget.
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk'
import type { ChatUserInput } from '@pragma/module-chat/contract'
import { BLOCK, FRAME } from './constants'

export interface UserInputQueue {
  /** The SDK's streaming-input prompt; stays open until `end`/`fail`. */
  messages: AsyncIterable<SDKUserMessage>
  push(message: SDKUserMessage): void
  end(): void
  fail(error: Error): void
}

export function createUserInputQueue(): UserInputQueue {
  const queued: SDKUserMessage[] = []
  let wake: (() => void) | null = null
  let ended = false
  let failure: Error | null = null
  const notify = () => {
    wake?.()
    wake = null
  }
  async function* drain(): AsyncGenerator<SDKUserMessage> {
    for (;;) {
      const next = queued.shift()
      if (next) {
        yield next
        continue
      }
      if (failure) throw failure
      if (ended) return
      await new Promise<void>((resolve) => {
        wake = resolve
      })
    }
  }
  return {
    messages: drain(),
    push(message) {
      if (ended || failure) return
      queued.push(message)
      notify()
    },
    end() {
      ended = true
      notify()
    },
    fail(error) {
      failure ??= error
      queued.length = 0
      notify()
    },
  }
}

const BASE64 = 'base64'

/** A user turn: one text block plus one base64 image block per image. */
export function toSdkUserMessage(input: ChatUserInput, sessionId: string): SDKUserMessage {
  const images = input.images.map((i) => ({
    type: BLOCK.image,
    source: { type: BASE64, media_type: i.mediaType, data: i.dataBase64 },
  }))
  const content = [...(input.text ? [{ type: BLOCK.text, text: input.text }] : []), ...images]
  return {
    type: FRAME.user,
    message: { role: FRAME.user, content },
    parent_tool_use_id: null,
    session_id: sessionId,
  } as SDKUserMessage
}
