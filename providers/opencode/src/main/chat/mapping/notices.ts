import { type ChatEvent, EVENT_KIND as K } from '@pragma/module-chat/contract'
import { CUSTOM, NOTICE, type NoticePayload } from '../../../renderer/chat/payloads'
import type { ModelRef } from '../schemas'

/** An inline `custom:opencode.notice` row. */
export const noticeEvent = (data: NoticePayload): ChatEvent => ({ kind: K.custom, type: CUSTOM.notice, data })

/** Another primary agent took over (history `agent-switched`, live `session.agent.selected`). */
export const agentSwitchEvents = (agent: string): ChatEvent[] => [noticeEvent({ notice: NOTICE.agent, agent })]

/** A model change; the session's first selection (no `previous`) is not a switch and stays silent. */
export const modelSwitchEvents = (model: ModelRef, previous: ModelRef | undefined): ChatEvent[] =>
  previous ? [noticeEvent({ notice: NOTICE.model, model: model.id })] : []

/** `system`/`synthetic` text is for the model; only OpenCode's own transcript summary is shown. */
export const injectedTextEvents = (description: string | undefined): ChatEvent[] =>
  description ? [noticeEvent({ notice: NOTICE.system, text: description })] : []
