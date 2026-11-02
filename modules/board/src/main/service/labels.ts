import {
  BOARD_ERROR,
  BoardError,
  CHANGE_KIND,
  LABEL_COLORS,
  type LabelColor,
  type LabelDto,
  type LabelId,
  type LabelRef,
  NameSchema,
} from '../../contract'
import { columnMergeKey } from '../../lib/merge-columns'
import { parseLabelIds, serializeLabelIds, toLabelDto } from '../lib/mappers'
import type { BoardRow, LabelRow } from '../schema'
import type { BoardCore } from './core'

/** Labels per board; names match case-insensitively, new ones take the next colour round-robin. */
export function createLabelOps(core: BoardCore) {
  const { repo } = core
  const nextColor = (board: BoardRow): LabelColor =>
    LABEL_COLORS[repo.listLabels(board.id).length % LABEL_COLORS.length] as LabelColor
  const byName = (board: BoardRow, name: string): LabelRow | undefined =>
    repo.listLabels(board.id).find((l) => columnMergeKey(l.name) === columnMergeKey(name))

  function requireLabel(id: LabelId): LabelRow {
    const l = repo.getLabel(id)
    if (!l) throw new BoardError(BOARD_ERROR.not_found, `label ${id} not found`)
    return l
  }

  /** Label refs → ids of `board` (call inside a transaction: names are created on the fly). */
  function resolve(board: BoardRow, refs: readonly LabelRef[]): LabelId[] {
    const ids = refs.map((ref) => {
      if (typeof ref === 'number') {
        if (repo.getLabel(ref)?.boardId !== board.id)
          throw new BoardError(BOARD_ERROR.validation, `label ${ref} is not in board ${board.id}`)
        return ref
      }
      const name = NameSchema.parse(ref)
      return (byName(board, name) ?? repo.insertLabel({ boardId: board.id, name, color: nextColor(board) })).id
    })
    return [...new Set(ids)]
  }

  function insert(board: BoardRow, rawName: string, color?: LabelColor): LabelRow {
    const name = NameSchema.parse(rawName)
    if (byName(board, name)) throw new BoardError(BOARD_ERROR.validation, `label "${name}" already exists`)
    return repo.insertLabel({ boardId: board.id, name, color: color ?? nextColor(board) })
  }

  return {
    resolve,
    async createLabel(projectId: string, name: string, color?: LabelColor): Promise<LabelDto> {
      const board = await core.ensureBoard(projectId)
      const row = repo.transaction(() => insert(board, name, color))
      core.changed(board, [], CHANGE_KIND.label)
      return toLabelDto(row)
    },
    async updateLabel(labelId: LabelId, patch: { name?: string; color?: LabelColor }): Promise<LabelDto> {
      const label = requireLabel(labelId)
      const board = core.requireBoard(label.boardId)
      const row = repo.transaction(() => {
        const name = patch.name === undefined ? undefined : NameSchema.parse(patch.name)
        const clash = name === undefined ? undefined : byName(board, name)
        if (clash && clash.id !== labelId)
          throw new BoardError(BOARD_ERROR.validation, `label "${name}" already exists`)
        return repo.updateLabel(labelId, {
          ...(name !== undefined && { name }),
          ...(patch.color && { color: patch.color }),
        })
      })
      core.changed(board, [], CHANGE_KIND.label)
      return toLabelDto(row)
    },
    async deleteLabel(labelId: LabelId): Promise<void> {
      const label = requireLabel(labelId)
      const board = core.requireBoard(label.boardId)
      const affected = repo.transaction(() => {
        const touched = repo
          .listTasks({ boardIds: [board.id] })
          .filter((t) => parseLabelIds(t.labelsJson).includes(labelId))
        for (const t of touched)
          repo.updateTask(t.id, {
            labelsJson: serializeLabelIds(parseLabelIds(t.labelsJson).filter((id) => id !== labelId)),
          })
        repo.deleteLabel(labelId)
        return touched.map((t) => t.id)
      })
      core.changed(board, affected, CHANGE_KIND.label)
    },
  }
}

export type LabelOps = ReturnType<typeof createLabelOps>
