import { useT } from '@pragma/sdk/renderer'
import { FileIcon } from '@pragma/ui/components/file-icon'
import { Globe } from '@pragma/ui/icons'
import type { Comment } from '../../contract'
import { COMMENTS_TESTIDS as T } from '../../contract'
import { groupThreads, pageLabel, splitPath, THREAD_GROUP_KINDS, type ThreadGroup } from '../lib/group-threads'
import { CommentRow } from './CommentRow'

const ICON_PX = 14
const PAGE = THREAD_GROUP_KINDS[1]

/** File: icon, file name, its directory (cut from the start when long); page: globe and `host/path`. */
function GroupTitle({ group }: { group: ThreadGroup }) {
  if (group.kind === PAGE)
    return (
      <span className="flex min-w-0 items-center gap-2" title={group.key}>
        <Globe size={ICON_PX} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate font-medium text-[12.5px] text-foreground">{pageLabel(group.key)}</span>
      </span>
    )
  const { dir, base } = splitPath(group.key)
  return (
    <span className="flex min-w-0 items-center gap-2" title={group.key}>
      <FileIcon path={group.key} size={ICON_PX} className="shrink-0" />
      <span className="shrink-0 font-medium text-[12.5px] text-foreground">{base}</span>
      {dir ? (
        <span dir="rtl" className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
          <bdi>{dir}</bdi>
        </span>
      ) : null}
    </span>
  )
}

function GroupHeader({ group }: { group: ThreadGroup }) {
  const t = useT()
  const count = group.threads.length
  return (
    <div
      data-testid={T.drawerGroupHeader}
      className="sticky top-0 z-10 flex h-8 items-center gap-2 border-[var(--bd)] border-b bg-[var(--pn)] px-4"
    >
      <GroupTitle group={group} />
      <span
        title={t('comments:drawer.groupCount', { count })}
        className="ml-auto shrink-0 rounded-full bg-[var(--hv)] px-1.5 text-[10.5px] text-muted-foreground tabular-nums leading-[16px]"
      >
        {count}
      </span>
    </div>
  )
}

/** Threads grouped per file (browser threads per page), each group a sticky header over its cards. */
export function ThreadGroups({ threads }: { threads: readonly Comment[] }) {
  return (
    <>
      {groupThreads(threads).map((g) => (
        <section key={`${g.kind}:${g.key}`} data-testid={T.drawerGroup} data-path={g.key} data-kind={g.kind}>
          <GroupHeader group={g} />
          <ul className="flex flex-col gap-2 px-3 py-2.5">
            {g.threads.map((c) => (
              <CommentRow key={c.id} comment={c} />
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
