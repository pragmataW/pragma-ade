import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { ClipboardList } from '@pragma/ui/icons'
import { useState } from 'react'
import { COMPOSER_ROWS, PLAN_MAX_H_PX, SIZE_SM, VARIANT_GHOST, VARIANT_OUTLINE } from '../../../constants'
import {
  CHAT_TESTIDS,
  type ChatOptionChoice,
  type ChatPartProps,
  type ChatPlanResponse,
  type ChatSessionApi,
  EVENT_KIND,
  type PlanItem,
  type TextItem,
} from '../../../contract'
import { Segmented } from '../../lib/Segmented'
import { useChoiceLabel } from '../controls/use-choice-label'
import { permissionModeOf, useModeConfirm } from '../controls/use-permission-mode'
import { AssistantText } from './AssistantText'
import { PromptCard } from './lib/PromptCard'

/** The modes offered on approve: `item.modes` (in that order), else every described mode but the current one. */
function approveModes(item: PlanItem, session: ChatSessionApi): ChatOptionChoice[] {
  const d = permissionModeOf(session)
  const all = d?.values ?? []
  if (item.modes) return item.modes.flatMap((m) => all.filter((c) => c.value === m))
  return all.filter((c) => c.value !== d?.current)
}

const firstSafe = (modes: ChatOptionChoice[]) => (modes.find((m) => !m.dangerous) ?? modes[0])?.value

function Feedback({ onSend, onCancel, busy }: { onSend(text: string): void; onCancel(): void; busy: boolean }) {
  const t = useT()
  const [text, setText] = useState('')
  return (
    <div className="flex w-full flex-col gap-2">
      <textarea
        data-testid={CHAT_TESTIDS.planFeedback}
        value={text}
        rows={COMPOSER_ROWS}
        // biome-ignore lint/a11y/noAutofocus: opened by the user's own click to write feedback
        autoFocus
        aria-label={t('chat:plan.feedbackLabel')}
        placeholder={t('chat:plan.feedbackPlaceholder')}
        onChange={(e) => setText(e.target.value)}
        className="w-full resize-none rounded-md border border-bd2 bg-bg px-2 py-1.5 text-[12.5px] text-tx outline-none placeholder:text-fa focus:border-act"
      />
      <div className="flex justify-end gap-2">
        <Button size={SIZE_SM} variant={VARIANT_GHOST} onClick={onCancel}>
          {t('chat:plan.cancel')}
        </Button>
        <Button
          size={SIZE_SM}
          variant={VARIANT_OUTLINE}
          data-testid={CHAT_TESTIDS.planReject}
          disabled={busy}
          onClick={() => onSend(text.trim())}
        >
          {t('chat:plan.sendFeedback')}
        </Button>
      </div>
    </div>
  )
}

/**
 * A proposed plan (Markdown, as assistant prose): approve and continue in a chosen permission mode (confirming
 * dangerous ones), or keep planning with feedback. Replies with `ChatPlanResponse` through `respond`.
 */
export function PlanApprovalCard({ item, session }: ChatPartProps<PlanItem>) {
  const t = useT()
  const label = useChoiceLabel()
  const confirm = useModeConfirm()
  const modes = approveModes(item, session)
  const [mode, setMode] = useState(() => firstSafe(modes))
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const reply = async (r: ChatPlanResponse) => {
    setBusy(true)
    await session.respond(item.id, r).finally(() => setBusy(false))
  }
  const approve = async () => {
    const choice = modes.find((m) => m.value === mode)
    if (choice && !(await confirm(choice))) return
    await reply({ approve: true, ...(typeof mode === 'string' ? { mode } : {}) })
  }
  const plan: TextItem = {
    kind: EVENT_KIND.textDelta,
    id: item.id,
    messageId: item.id,
    text: item.plan,
    streaming: false,
  }
  return (
    <PromptCard
      testId={CHAT_TESTIDS.part(EVENT_KIND.planProposal)}
      icon={ClipboardList}
      title={t('chat:plan.title')}
      resolved={item.resolved}
      summary={item.summary}
      actions={
        rejecting ? (
          <Feedback
            busy={busy}
            onCancel={() => setRejecting(false)}
            onSend={(feedback) => void reply({ approve: false, ...(feedback ? { feedback } : {}) })}
          />
        ) : (
          <>
            {modes.length > 0 ? (
              <span className="mr-auto flex items-center gap-2 text-[12px] text-mu">
                {t('chat:plan.continueIn')}
                <Segmented
                  value={String(mode)}
                  onChange={(v) => setMode(modes.find((m) => String(m.value) === v)?.value)}
                  items={modes.map((m) => ({
                    value: String(m.value),
                    label: label(m),
                    testId: CHAT_TESTIDS.planMode(String(m.value)),
                  }))}
                />
              </span>
            ) : null}
            <Button size={SIZE_SM} variant={VARIANT_GHOST} onClick={() => setRejecting(true)}>
              {t('chat:plan.keepPlanning')}
            </Button>
            <Button
              size={SIZE_SM}
              data-testid={CHAT_TESTIDS.planApprove}
              disabled={busy}
              onClick={() => void approve()}
            >
              {t('chat:plan.approve')}
            </Button>
          </>
        )
      }
    >
      <div style={{ maxHeight: PLAN_MAX_H_PX }} className="overflow-y-auto">
        <AssistantText item={plan} session={session} />
      </div>
    </PromptCard>
  )
}
