import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { ShieldAlert } from '@pragma/ui/icons'
import { ICON_PX, ICON_STROKE, JSON_INDENT, SHELL_OUTPUT_MAX_H_PX, SIZE_SM } from '../../../constants'
import {
  CHAT_TESTIDS,
  type ChatPartProps,
  type ChatPermissionOptionId,
  EVENT_KIND,
  type FileEditHunk,
  PERMISSION_OPTION,
  type PermissionItem,
} from '../../../contract'
import { HunkDiff } from './HunkDiff'
import { MonoPre } from './lib/MonoPre'

const LABELS: Record<ChatPermissionOptionId, string> = {
  [PERMISSION_OPTION.allow_once]: 'chat:permission.allow',
  [PERMISSION_OPTION.allow_always]: 'chat:permission.alwaysAllow',
  [PERMISSION_OPTION.deny]: 'chat:permission.deny',
}
const VARIANTS: Record<ChatPermissionOptionId, 'default' | 'outline' | 'ghost'> = {
  [PERMISSION_OPTION.allow_once]: 'default',
  [PERMISSION_OPTION.allow_always]: 'outline',
  [PERMISSION_OPTION.deny]: 'ghost',
}

type Input = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

/** An edit-like input as one hunk (`old_string`/`new_string` or `content`), else null. */
export function hunkPreview(input: unknown): { path: string; hunks: FileEditHunk[] } | null {
  const i = (input && typeof input === 'object' ? input : {}) as Input
  const path = str(i.file_path) ?? ''
  const after = str(i.new_string) ?? str(i.content)
  if (after === undefined) return null
  return { path, hunks: [{ before: str(i.old_string) ?? '', after }] }
}

function Preview({ input }: { input: unknown }) {
  const hunk = hunkPreview(input)
  if (hunk) return <HunkDiff path={hunk.path} hunks={hunk.hunks} />
  return (
    <MonoPre maxHeight={SHELL_OUTPUT_MAX_H_PX} className="px-2.5 py-2 text-mu">
      {JSON.stringify(input ?? {}, null, JSON_INDENT)}
    </MonoPre>
  )
}

/** A permission request (warn accent): preview, then one button per option, or the outcome once resolved. */
export function PermissionCard({ item, session }: ChatPartProps<PermissionItem>) {
  const t = useT()
  return (
    <div
      data-testid={CHAT_TESTIDS.part(EVENT_KIND.permissionRequest)}
      className="overflow-hidden rounded-lg border border-warn/60 bg-el"
    >
      <div className="flex items-start gap-2 px-2.5 py-2">
        <ShieldAlert size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="mt-0.5 shrink-0 text-warn" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[12.5px] text-tx">
            <span className="font-semibold">{item.toolName}</span>{' '}
            <span className="font-mono text-[12px] text-mu">{item.title}</span>
          </span>
          {item.detail ? <span className="text-[12px] text-mu">{item.detail}</span> : null}
        </div>
      </div>
      <div className="border-y border-bd">
        <Preview input={item.input} />
      </div>
      <div className="flex items-center justify-end gap-2 px-2.5 py-2">
        {item.outcome ? (
          <span data-testid={CHAT_TESTIDS.permissionOutcome} className="text-[12px] text-mu">
            {t(`chat:permission.outcome.${item.outcome}`)}
          </span>
        ) : (
          item.options.map((option) => (
            <Button
              key={option}
              size={SIZE_SM}
              variant={VARIANTS[option]}
              data-testid={CHAT_TESTIDS.permission(option)}
              onClick={() => void session.respondPermission(item.id, option)}
            >
              {t(LABELS[option])}
            </Button>
          ))
        )}
      </div>
    </div>
  )
}
