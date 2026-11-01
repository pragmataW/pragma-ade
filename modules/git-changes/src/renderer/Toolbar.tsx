import { BRANCH_KINDS } from '@pragma/module-projects/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@pragma/ui/components/select'
import { ToggleGroup, ToggleGroupItem } from '@pragma/ui/components/toggle-group'
import { MERGE_BASE_SHORT_LEN, ROLE_ALERT, SIZE_SM, VARIANT_GHOST, VARIANT_OUTLINE } from '../constants'
import {
  type BaseBranchOption,
  CHANGE_LIST_STATE,
  CHANGE_MODE,
  CHANGE_MODES,
  type ChangeList,
  type ChangeMode,
  DIFF_STYLES,
  type GitChangesSettings,
  listBranchesIpc,
  setBaseBranchIpc,
  GitChangesTestIds as T,
  VIEW_MODES,
} from '../contract'
import { useChangedCount } from './lib/projects'
import { getRendererCtx } from './lib/sdk'
import { useKeyedLatest } from './use-changes'

export type ChangeLists = Record<ChangeMode, ChangeList | undefined>

export interface ToolbarProps {
  worktreeId: string
  mode: ChangeMode
  lists: ChangeLists
  settings: GitChangesSettings
  onModeChange(mode: ChangeMode): void
}

const [TREE, LIST] = VIEW_MODES
const [UNIFIED, SPLIT] = DIFF_STYLES
const SECONDARY = 'secondary'
const MODE_LABEL_KEYS = {
  uncommitted: 'git-changes:mode.uncommitted',
  branch: 'git-changes:mode.branch',
} as const satisfies Record<ChangeMode, string>
const BRANCH_GROUP_KEYS = {
  local: 'git-changes:toolbar.local',
  remote: 'git-changes:toolbar.remote',
} as const satisfies Record<BaseBranchOption['kind'], string>

const fileCount = (l: ChangeList | undefined): number | null =>
  l?.state === CHANGE_LIST_STATE.ok ? l.files.length : null

function ModeToggle({ worktreeId, mode, lists, onModeChange }: Omit<ToolbarProps, 'settings'>) {
  const t = useT()
  const fallback = useChangedCount(worktreeId)
  const counts: Record<ChangeMode, number | null> = {
    uncommitted: fileCount(lists.uncommitted) ?? fallback,
    branch: fileCount(lists.branch),
  }
  return (
    <ToggleGroup
      type="single"
      variant={VARIANT_OUTLINE}
      size={SIZE_SM}
      value={mode}
      aria-label={t('git-changes:mode.label')}
      onValueChange={(v) => {
        if (v) onModeChange(v as ChangeMode)
      }}
    >
      {CHANGE_MODES.map((m) => (
        <ToggleGroupItem key={m} value={m} data-testid={T.mode(m)} className="px-2.5 text-xs">
          {t(MODE_LABEL_KEYS[m])}
          {counts[m] === null ? null : (
            <span className="ml-1 text-muted-foreground">{t('git-changes:mode.count', { count: counts[m] })}</span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function useBranchOptions(worktreeId: string): BaseBranchOption[] {
  const loaded = useKeyedLatest(worktreeId, () => getRendererCtx().ipc.invoke(listBranchesIpc, { worktreeId }))
  return loaded.data?.branches ?? []
}

function BranchInfo({ list }: { list: ChangeList }) {
  const t = useT()
  if (list.state === CHANGE_LIST_STATE.ok)
    return (
      <span className="truncate text-muted-foreground text-xs">
        {list.commitCount === null ? null : `· ${t('git-changes:toolbar.commits', { count: list.commitCount })}`}
        {list.mergeBase === null
          ? null
          : ` · ${t('git-changes:toolbar.mergeBase', { sha: list.mergeBase.slice(0, MERGE_BASE_SHORT_LEN) })}`}
      </span>
    )
  const key =
    list.state === CHANGE_LIST_STATE.baseNotFound ? 'git-changes:errors.baseNotFound' : 'git-changes:errors.noMergeBase'
  return (
    <span data-testid={T.baseError} role={ROLE_ALERT} className="truncate text-[var(--err)] text-xs">
      {t(key, { base: list.baseBranch })}
    </span>
  )
}

function BasePicker({ worktreeId, list }: { worktreeId: string; list: ChangeList }) {
  const t = useT()
  const options = useBranchOptions(worktreeId)
  const choose = (baseBranch: string) => {
    if (baseBranch === list.baseBranch) return
    getRendererCtx()
      .ipc.invoke(setBaseBranchIpc, { worktreeId, baseBranch })
      .catch((e: unknown) => console.warn('git-changes: setBaseBranch failed', e))
  }
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Select value={list.baseBranch} onValueChange={choose}>
        <SelectTrigger
          size={SIZE_SM}
          data-testid={T.basePicker}
          aria-label={t('git-changes:toolbar.baseLabel')}
          className="h-7 gap-1 px-2 font-mono text-xs"
        >
          {t('git-changes:toolbar.vsBase', { base: list.baseBranch })}
        </SelectTrigger>
        <SelectContent>
          {BRANCH_KINDS.map((kind) => {
            const items = options.filter((o) => o.kind === kind)
            if (items.length === 0) return null
            return (
              <SelectGroup key={kind}>
                <SelectLabel>{t(BRANCH_GROUP_KEYS[kind])}</SelectLabel>
                {items.map((o) => (
                  <SelectItem key={o.name} value={o.name} className="font-mono text-xs">
                    {o.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )
          })}
        </SelectContent>
      </Select>
      <BranchInfo list={list} />
    </div>
  )
}

function PrefToggle({
  testId,
  pressed,
  onClick,
  label,
}: {
  testId: string
  pressed: boolean
  onClick(): void
  label: string
}) {
  return (
    <Button
      size={SIZE_SM}
      variant={pressed ? SECONDARY : VARIANT_GHOST}
      data-testid={testId}
      aria-pressed={pressed}
      onClick={onClick}
      className="h-7 px-2 text-xs"
    >
      {label}
    </Button>
  )
}

function ViewToggles({ settings }: { settings: GitChangesSettings }) {
  const t = useT()
  const update = (patch: Partial<GitChangesSettings>) =>
    void getRendererCtx()
      .settings.update(patch)
      .catch((e: unknown) => console.warn('git-changes: settings update failed', e))
  const isTree = settings.viewMode === TREE
  const isUnified = settings.diffStyle === UNIFIED
  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      <PrefToggle
        testId={T.toggleView}
        pressed={!isTree}
        onClick={() => update({ viewMode: isTree ? LIST : TREE })}
        label={t(isTree ? 'git-changes:toolbar.viewTree' : 'git-changes:toolbar.viewList')}
      />
      <PrefToggle
        testId={T.toggleStyle}
        pressed={!isUnified}
        onClick={() => update({ diffStyle: isUnified ? SPLIT : UNIFIED })}
        label={t(isUnified ? 'git-changes:toolbar.unified' : 'git-changes:toolbar.split')}
      />
      <PrefToggle
        testId={T.toggleFull}
        pressed={settings.showFullFile}
        onClick={() => update({ showFullFile: !settings.showFullFile })}
        label={t('git-changes:toolbar.fullFile')}
      />
    </div>
  )
}

/** Mode toggle with counts, base picker (branch mode), totals and the view preferences. */
export function Toolbar(props: ToolbarProps) {
  const t = useT()
  const list = props.lists[props.mode]
  return (
    <div className="flex flex-wrap items-center gap-2 border-[var(--bd)] border-b bg-[var(--pn)] px-2 py-1.5">
      <ModeToggle {...props} />
      {props.mode === CHANGE_MODE.branch && list ? <BasePicker worktreeId={props.worktreeId} list={list} /> : null}
      {list?.state === CHANGE_LIST_STATE.ok ? (
        <span data-testid={T.totals} className="font-mono text-muted-foreground text-xs">
          {t('git-changes:toolbar.totals', list.totals)}
        </span>
      ) : null}
      <ViewToggles settings={props.settings} />
    </div>
  )
}
