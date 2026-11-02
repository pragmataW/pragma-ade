import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { SendHorizontal } from '@pragma/ui/icons'
import type { ClipboardEvent, DragEvent } from 'react'
import { COMPOSER_ROWS, ICON_PX, ICON_STROKE, SIZE_SM } from '../../../constants'
import {
  CHAT_TESTIDS,
  type ChatSessionApi,
  type ChatSlotComponent,
  type ComposerApi,
  type ComposerExtension,
} from '../../../contract'
import { ComposerChips } from './ComposerChips'
import { QueueChips } from './QueueChips'
import { useComposer } from './use-composer'

function ExtensionAreas({
  extensions,
  api,
  area,
}: {
  extensions: readonly ComposerExtension[]
  api: ComposerApi
  area: 'aboveInput' | 'toolbar'
}) {
  return (
    <>
      {extensions.map((ext) => {
        const Area = ext[area]
        return Area ? <Area key={ext.id} api={api} /> : null
      })}
    </>
  )
}

/** Composer (radius 10): extension areas, queue chips, textarea, toolbar; Enter sends, Shift+Enter is a newline. */
export function Composer({
  session,
  extensions = [],
  toolbar = [],
}: {
  session: ChatSessionApi
  extensions?: readonly ComposerExtension[]
  toolbar?: readonly ChatSlotComponent[]
}) {
  const t = useT()
  const c = useComposer(session, extensions)
  const Menu = c.menu?.ext.trigger?.menu
  const offer = <E,>(handler: 'onPaste' | 'onDrop', e: E & { preventDefault(): void }) => {
    for (const ext of extensions)
      if ((ext[handler] as ((ev: E, api: ComposerApi) => boolean) | undefined)?.(e, c.api)) return e.preventDefault()
  }
  return (
    <div data-testid={CHAT_TESTIDS.composer} className="relative rounded-xl border border-bd2 bg-el">
      {Menu && c.menu ? (
        <div className="absolute right-0 bottom-full left-0 mb-1 overflow-hidden rounded-xl border border-bd bg-el shadow-lg">
          <Menu
            query={c.menu.query}
            api={c.api}
            onPick={c.pick}
            onClose={c.closeMenu}
            activeIndex={c.activeIndex}
            setCount={c.setCount}
            pickRequest={c.pickRequest}
          />
        </div>
      ) : null}
      <ExtensionAreas extensions={extensions} api={c.api} area="aboveInput" />
      <ComposerChips chips={c.chips.list} onRemove={c.chips.remove} />
      <QueueChips session={session} />
      <textarea
        ref={c.ref}
        data-testid={CHAT_TESTIDS.composerInput}
        rows={COMPOSER_ROWS}
        value={c.api.text}
        placeholder={t('chat:composer.placeholder')}
        onChange={(e) => c.sync(e.target.value, e.target.selectionStart)}
        onKeyDown={c.onKeyDown}
        onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => offer('onPaste', e)}
        onDrop={(e: DragEvent<HTMLTextAreaElement>) => offer('onDrop', e)}
        className="field-sizing-content block max-h-60 min-h-12 w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] text-tx outline-none placeholder:text-fa"
      />
      {c.notice ? <div className="px-3 text-[11.5px] text-warn">{t(c.notice)}</div> : null}
      <div className="flex h-9 items-center gap-1 px-1.5">
        <ExtensionAreas extensions={extensions} api={c.api} area="toolbar" />
        <div className="ml-auto flex items-center gap-1">
          {toolbar.map((Slot, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: slot components have no identity of their own
            <Slot key={i} session={session} />
          ))}
          <Button size={SIZE_SM} data-testid={CHAT_TESTIDS.send} onClick={() => void c.send()} className="gap-1 px-2.5">
            <SendHorizontal size={ICON_PX} strokeWidth={ICON_STROKE} />
            {t('chat:composer.send')}
          </Button>
        </div>
      </div>
    </div>
  )
}
