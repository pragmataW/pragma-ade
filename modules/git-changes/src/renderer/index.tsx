import { ProjectsRendererServiceToken } from '@pragma/module-projects/contract'
import { defineRendererModule } from '@pragma/sdk/renderer'
import { TAB_ICON, TAB_ID, TAB_ORDER } from '../constants'
import {
  CHANGE_LIST_STATE,
  CHANGE_MODE,
  type GitChangesSettings,
  listChangesIpc,
  REVEAL_COMMAND_ID,
  RevealArgsSchema,
  TOGGLE_FILE_LIST_COMMAND_ID,
} from '../contract'
import { GitChangesPanel } from './GitChangesPanel'
import { type GitChangesRendererContext, setRendererCtx } from './lib/sdk'
import { useGitChangesStore } from './store'
import { entryKey } from './tree/build-tree'
import './styles.css'

/** Mirrors 01's changed-file count of the active worktree into the tab badge (null hides it). */
function startBadge(ctx: GitChangesRendererContext): void {
  const projects = ctx.services.get(ProjectsRendererServiceToken)
  let shown: number | null | undefined
  const update = () => {
    const active = projects.getActiveWorktree()
    const count = active ? (projects.getSnapshot().changedFiles[active.id] ?? 0) : 0
    const badge = count > 0 ? count : null
    if (badge === shown) return
    shown = badge
    ctx.panels.setBadge(TAB_ID, badge)
  }
  update()
  projects.subscribe(update)
}

/** `gitChanges.reveal {worktreeId, path}`: picks the mode that lists the file, selects it and shows the tab. */
async function reveal(ctx: GitChangesRendererContext, raw: unknown): Promise<void> {
  const { worktreeId, path } = RevealArgsSchema.parse(raw)
  const list = await ctx.ipc.invoke(listChangesIpc, { worktreeId, mode: CHANGE_MODE.uncommitted }).catch(() => null)
  const files = list?.state === CHANGE_LIST_STATE.ok ? list.files : null
  // The unstaged entry wins over the staged one of the same path (it is what the disk shows).
  const entry = files?.find((f) => f.path === path && !f.staged) ?? files?.find((f) => f.path === path)
  useGitChangesStore.getState().reveal(worktreeId, entry ? entryKey(entry) : path, files?.map(entryKey) ?? null)
  ctx.panels.activateRightTab(TAB_ID)
}

export default defineRendererModule<GitChangesSettings>({
  activate(ctx) {
    setRendererCtx(ctx)
    ctx.panels.registerRightTab({
      id: TAB_ID,
      titleKey: 'git-changes:tab.title',
      icon: TAB_ICON,
      order: TAB_ORDER,
      component: GitChangesPanel,
    })
    startBadge(ctx)
    ctx.commands.register(REVEAL_COMMAND_ID, (raw) => reveal(ctx, raw), { titleKey: 'git-changes:commands.reveal' })
    ctx.commands.register(TOGGLE_FILE_LIST_COMMAND_ID, () => useGitChangesStore.getState().toggleTree(), {
      titleKey: 'git-changes:commands.toggleFileList',
    })
  },
})
