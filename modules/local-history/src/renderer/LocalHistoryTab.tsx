import { useLatestAsync, useRendererContext, useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { CodeBlock } from '@pragma/ui/components/code-block'
import { FileIcon } from '@pragma/ui/components/file-icon'
import { Icon } from '@pragma/ui/components/icon'
import { useEffect, useState } from 'react'
import { BUTTON, ICONS, ROW_ICON_PX as ICON_PX, PLAIN_LANG, SHORT_SHA } from '../constants'
import {
  type EntryFile,
  type EntrySummary,
  FILE_STATE,
  LocalHistoryIpc,
  type LocalHistorySettings,
  LOCAL_HISTORY_TESTIDS as T,
} from '../contract'
import { confirmRestore, reportRestore } from './restore'

const TIME = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const SEPARATOR = /[\\/]/
const lastSegment = (path: string): string => path.split(SEPARATOR).filter(Boolean).pop() ?? path
const langOf = (path: string): string => path.split('.').pop() ?? PLAIN_LANG

type Selected = { id: number; path: string } | null

function useRestore() {
  const ctx = useRendererContext<LocalHistorySettings>()
  return async (id: number, paths?: string[]) => {
    if (!(await confirmRestore(ctx))) return
    reportRestore(ctx, await ctx.ipc.invoke(LocalHistoryIpc.restore, { id, paths }))
  }
}

function RowButton(props: { icon: string; label: string; testId: string; onClick(): void }) {
  return (
    <button
      type={BUTTON}
      data-testid={props.testId}
      aria-label={props.label}
      title={props.label}
      onClick={(e) => {
        e.stopPropagation()
        props.onClick()
      }}
      className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-button)] text-[var(--mu)] hover:bg-[var(--hv)] hover:text-[var(--tx)]"
    >
      <Icon name={props.icon} size={ICON_PX} />
    </button>
  )
}

function FileRow(props: { entryId: number; file: EntryFile; selected: boolean; onSelect(): void }) {
  const t = useT()
  const restore = useRestore()
  const { entryId, file } = props
  return (
    <div
      data-testid={T.file(entryId, file.path)}
      onClick={props.onSelect}
      onKeyDown={(e) => e.key === 'Enter' && props.onSelect()}
      role="option"
      aria-selected={props.selected}
      tabIndex={0}
      className={cn(
        'group flex h-[var(--row-h)] cursor-pointer items-center gap-2 pr-1 pl-8 hover:bg-[var(--hv)]',
        props.selected && 'bg-[var(--el)]',
      )}
    >
      <FileIcon path={file.path} size={ICON_PX} />
      <span className="min-w-0 flex-1 truncate" title={file.path}>
        {file.path}
      </span>
      {file.state !== FILE_STATE.saved && (
        <span className="shrink-0 text-[11px] text-[var(--mu)]">{t(`local-history:state.${file.state}`)}</span>
      )}
      <RowButton
        icon={ICONS.restore}
        label={t('local-history:tab.restore')}
        testId={T.restoreFile(entryId, file.path)}
        onClick={() => void restore(entryId, [file.path])}
      />
    </div>
  )
}

function EntryFiles(props: { entry: EntrySummary; selected: Selected; onSelect(s: Selected): void }) {
  const t = useT()
  const ctx = useRendererContext()
  const { entry } = props
  const detail = useLatestAsync(() => ctx.ipc.invoke(LocalHistoryIpc.detail, { id: entry.id }), [ctx, entry])
  return (
    <div role="listbox">
      {detail.data?.files.map((file) => (
        <FileRow
          key={file.path}
          entryId={entry.id}
          file={file}
          selected={props.selected?.id === entry.id && props.selected.path === file.path}
          onSelect={() => props.onSelect({ id: entry.id, path: file.path })}
        />
      ))}
      {detail.data?.stashes.map((s) => (
        <div key={s.sha} className="flex h-[var(--row-h)] items-center gap-2 pl-8 text-[var(--mu)]">
          <Icon name="archive" size={ICON_PX} />
          <span className="truncate">{s.message}</span>
        </div>
      ))}
      {entry.headSha && (
        <div className="flex h-[var(--row-h)] items-center gap-2 pl-8 font-mono text-[var(--mu)]">
          <Icon name="git-commit-horizontal" size={ICON_PX} />
          {t('local-history:tab.commit', { sha: entry.headSha.slice(0, SHORT_SHA) })}
        </div>
      )}
    </div>
  )
}

function EntryRow(props: { entry: EntrySummary; selected: Selected; onSelect(s: Selected): void }) {
  const t = useT()
  const ctx = useRendererContext()
  const restore = useRestore()
  const { entry } = props
  const [open, setOpen] = useState(false)
  const counts = [
    entry.fileCount > 0 && t('local-history:tab.files', { count: entry.fileCount }),
    entry.stashCount > 0 && t('local-history:tab.stashes', { count: entry.stashCount }),
  ].filter(Boolean)
  return (
    <div data-testid={T.entry(entry.id)} className="border-[var(--bd)] border-b">
      <div className="flex min-h-9 items-center gap-1 pr-1 hover:bg-[var(--hv)]">
        <button
          type={BUTTON}
          data-testid={T.entryToggle(entry.id)}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 pl-2 text-left"
        >
          <Icon name={open ? 'chevron-down' : 'chevron-right'} size={ICON_PX} className="text-[var(--mu)]" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[var(--tx)]">{t(`local-history:reason.${entry.reason}`)}</span>
            <span className="truncate text-[11px] text-[var(--mu)]">
              {[TIME.format(entry.createdAt), lastSegment(entry.cwd), ...counts].join(' · ')}
              {entry.restoredAt !== null && ` · ${t('local-history:tab.restored')}`}
            </span>
          </span>
        </button>
        <RowButton
          icon={ICONS.restore}
          label={t('local-history:tab.restoreAll')}
          testId={T.restoreEntry(entry.id)}
          onClick={() => void restore(entry.id)}
        />
        <RowButton
          icon={ICONS.remove}
          label={t('local-history:tab.remove')}
          testId={T.removeEntry(entry.id)}
          onClick={() => void ctx.ipc.invoke(LocalHistoryIpc.remove, { id: entry.id })}
        />
      </div>
      {open && <EntryFiles entry={entry} selected={props.selected} onSelect={props.onSelect} />}
    </div>
  )
}

function Preview({ selected }: { selected: NonNullable<Selected> }) {
  const t = useT()
  const ctx = useRendererContext()
  const content = useLatestAsync(() => ctx.ipc.invoke(LocalHistoryIpc.fileContent, selected), [ctx, selected])
  const c = content.data
  return (
    <div data-testid={T.preview} className="min-h-0 flex-1 overflow-auto border-[var(--bd)] border-t">
      {c?.saved != null && <CodeBlock code={c.saved} lang={langOf(selected.path)} className="m-0 rounded-none px-3 py-2" />}
      {c?.state === FILE_STATE.missing && (
        <p className="p-3 text-[var(--mu)]">{t('local-history:tab.missingPreview')}</p>
      )}
      {c && c.saved == null && c.state !== FILE_STATE.missing && (
        <p className="p-3 text-[var(--mu)]">
          {t('local-history:tab.noPreview', { state: t(`local-history:state.${c.state}`) })}
        </p>
      )}
    </div>
  )
}

/** Right-dock tab: what Git Changes threw away, newest first; restore an entry, one file, or preview it. */
export function LocalHistoryTab() {
  const t = useT()
  const ctx = useRendererContext()
  const list = useLatestAsync(() => ctx.ipc.invoke(LocalHistoryIpc.list, undefined), [ctx])
  const [selected, setSelected] = useState<Selected>(null)
  const { reload } = list
  useEffect(() => {
    const sub = ctx.ipc.subscribe(LocalHistoryIpc.changed, () => reload())
    return () => sub.dispose()
  }, [ctx, reload])
  const entries = list.data ?? []
  return (
    <div data-testid={T.tab} className="flex h-full min-h-0 flex-col text-[13px]">
      <div className={cn('min-h-0 overflow-auto', selected ? 'max-h-[55%]' : 'flex-1')}>
        {list.data && entries.length === 0 && (
          <p data-testid={T.empty} className="p-4 text-[var(--mu)]">
            {t('local-history:tab.empty')}
          </p>
        )}
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} selected={selected} onSelect={setSelected} />
        ))}
      </div>
      {selected && <Preview selected={selected} />}
    </div>
  )
}
