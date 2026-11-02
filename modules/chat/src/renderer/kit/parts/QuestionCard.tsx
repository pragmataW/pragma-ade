import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { MessageCircleQuestion } from '@pragma/ui/icons'
import { useId, useState } from 'react'
import { SIZE_SM } from '../../../constants'
import {
  CHAT_TESTIDS,
  type ChatPartProps,
  type ChatQuestion,
  type ChatQuestionResponse,
  EVENT_KIND,
  type QuestionItem,
} from '../../../contract'
import { PromptCard } from './lib/PromptCard'

interface Answer {
  selected: string[]
  /** null = "Other" not chosen. */
  other: string | null
}
const EMPTY: Answer = { selected: [], other: null }

const isAnswered = (a: Answer): boolean => a.selected.length > 0 || Boolean(a.other?.trim())

function toggle(q: ChatQuestion, a: Answer, label: string): Answer {
  if (!q.multiSelect) return { selected: [label], other: null }
  const has = a.selected.includes(label)
  return { ...a, selected: has ? a.selected.filter((l) => l !== label) : [...a.selected, label] }
}

const choiceRow =
  'flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-2 py-1.5 hover:bg-hv has-[:checked]:border-act/40 has-[:checked]:bg-acs has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-act/50'

/** One question: radios (single) or checkboxes (multi) with descriptions, plus an "Other" free-text answer. */
function QuestionField({
  q,
  index,
  answer,
  disabled,
  onChange,
}: {
  q: ChatQuestion
  index: number
  answer: Answer
  disabled: boolean
  onChange(a: Answer): void
}) {
  const t = useT()
  const name = useId()
  const type = q.multiSelect ? 'checkbox' : 'radio'
  const otherOn = answer.other !== null
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 flex items-center gap-2 text-[13px] text-tx">
        {q.header ? (
          <span className="rounded-sm bg-acs px-1.5 text-[11px] font-semibold text-act">{q.header}</span>
        ) : null}
        <span>{q.question}</span>
        {q.multiSelect ? <span className="text-[11px] text-mu">{t('chat:question.multi')}</span> : null}
      </legend>
      {q.options.map((o, i) => (
        <label key={o.label} className={choiceRow}>
          <input
            type={type}
            name={name}
            data-testid={CHAT_TESTIDS.questionOption(index, i)}
            checked={answer.selected.includes(o.label)}
            onChange={() => onChange(toggle(q, answer, o.label))}
            className="mt-0.5 accent-[var(--color-ac)]"
          />
          <span className="flex min-w-0 flex-col">
            <span className="text-[12.5px] text-tx">{o.label}</span>
            {o.description ? <span className="text-[11.5px] leading-4 text-mu">{o.description}</span> : null}
          </span>
        </label>
      ))}
      {q.allowOther === false ? null : (
        <label className={cn(choiceRow, 'items-center')}>
          <input
            type={type}
            name={name}
            checked={otherOn}
            onChange={() =>
              onChange(
                otherOn ? { ...answer, other: null } : { selected: q.multiSelect ? answer.selected : [], other: '' },
              )
            }
            aria-label={t('chat:question.other')}
            className="accent-[var(--color-ac)]"
          />
          <input
            data-testid={CHAT_TESTIDS.questionOther(index)}
            value={answer.other ?? ''}
            placeholder={t('chat:question.otherPlaceholder')}
            aria-label={t('chat:question.otherPlaceholder')}
            onChange={(e) => onChange({ selected: q.multiSelect ? answer.selected : [], other: e.target.value })}
            className="h-7 min-w-0 flex-1 rounded-md border border-bd2 bg-bg px-2 text-[12.5px] text-tx outline-none placeholder:text-fa focus:border-act"
          />
        </label>
      )}
    </fieldset>
  )
}

/** Multiple-choice questions from the agent; Submit sends `ChatQuestionResponse` through `respond`. */
export function QuestionCard({ item, session }: ChatPartProps<QuestionItem>) {
  const t = useT()
  const [answers, setAnswers] = useState<Answer[]>(() => item.questions.map(() => EMPTY))
  const [sending, setSending] = useState(false)
  const ready = item.questions.every((_, i) => isAnswered(answers[i] ?? EMPTY))
  const submit = async () => {
    const payload: ChatQuestionResponse = {
      answers: item.questions.map((q, i) => {
        const a = answers[i] ?? EMPTY
        const other = a.other?.trim()
        return { question: q.question, selected: a.selected, ...(other ? { other } : {}) }
      }),
    }
    setSending(true)
    await session.respond(item.id, payload).finally(() => setSending(false))
  }
  const title =
    item.questions.length > 1
      ? t('chat:question.titleMany', { count: item.questions.length })
      : t('chat:question.title')
  return (
    <PromptCard
      testId={CHAT_TESTIDS.part(EVENT_KIND.question)}
      icon={MessageCircleQuestion}
      title={title}
      resolved={item.resolved}
      summary={item.summary}
      actions={
        <Button
          size={SIZE_SM}
          data-testid={CHAT_TESTIDS.questionSubmit}
          disabled={!ready || sending}
          onClick={() => void submit()}
        >
          {t('chat:question.submit')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {item.questions.map((q, i) => (
          <QuestionField
            key={q.question}
            q={q}
            index={i}
            answer={answers[i] ?? EMPTY}
            disabled={Boolean(item.resolved) || sending}
            onChange={(a) => setAnswers((all) => all.map((x, k) => (k === i ? a : x)))}
          />
        ))}
      </div>
    </PromptCard>
  )
}
