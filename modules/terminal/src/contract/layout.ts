import { z } from '@pragma/sdk'
import { PtyExitSchema } from './pty'

/** `vertical` = side by side, `horizontal` = stacked. */
export const SPLIT = { horizontal: 'horizontal', vertical: 'vertical' } as const
export const SPLIT_ACTIONS = [SPLIT.horizontal, SPLIT.vertical] as const
export type SplitAction = (typeof SPLIT_ACTIONS)[number]
/** Panes one terminal tab can hold; the split actions are disabled at this count. */
export const MAX_PANES_PER_TAB = 6

export const LAYOUT_NODE = { pane: 'pane', split: 'split' } as const

export const TerminalPaneSchema = z.object({
  id: z.string(),
  /** Empty when the spawn failed (`error` set). */
  ptyId: z.string(),
  exit: PtyExitSchema.omit({ ptyId: true }).nullable(),
  error: z.string().nullable(),
})
export type TerminalPane = z.infer<typeof TerminalPaneSchema>

export const PaneNodeSchema = z.object({ kind: z.literal(LAYOUT_NODE.pane), paneId: z.string() })
export type PaneNode = z.infer<typeof PaneNodeSchema>

/** A row (`vertical`) or column (`horizontal`) of two or more children, each resizable against its siblings. */
export interface SplitNode {
  kind: typeof LAYOUT_NODE.split
  direction: SplitAction
  children: LayoutNode[]
}
/** The split tree of one tab (spelled out by hand because zod cannot infer a recursive type). */
export type LayoutNode = PaneNode | SplitNode

const MIN_SPLIT_CHILDREN = 2
export const SplitNodeSchema: z.ZodType<SplitNode> = z.object({
  kind: z.literal(LAYOUT_NODE.split),
  direction: z.enum(SPLIT_ACTIONS),
  get children() {
    return z.array(LayoutNodeSchema).min(MIN_SPLIT_CHILDREN)
  },
})
export const LayoutNodeSchema: z.ZodType<LayoutNode> = z.union([PaneNodeSchema, SplitNodeSchema])

/** Phase 02 tabs had `split: 'none' | 'horizontal' | 'vertical'` and at most two panes instead of `root`. */
const LEGACY_NO_SPLIT = 'none'
const LegacyTabSchema = z.looseObject({
  split: z.enum([LEGACY_NO_SPLIT, ...SPLIT_ACTIONS]),
  panes: z.array(z.looseObject({ id: z.string() })),
})

/** Rewrites a legacy binary-split tab into a split tree; anything else passes through unchanged. */
export function migrateLegacyTab(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || 'root' in raw) return raw
  const legacy = LegacyTabSchema.safeParse(raw)
  if (!legacy.success) return raw
  const { split, ...rest } = legacy.data
  const leaves: PaneNode[] = rest.panes.map((p) => ({ kind: LAYOUT_NODE.pane, paneId: p.id }))
  const [first] = leaves
  if (!first) return raw
  const root: LayoutNode =
    split === LEGACY_NO_SPLIT || leaves.length < MIN_SPLIT_CHILDREN
      ? first
      : { kind: LAYOUT_NODE.split, direction: split, children: leaves }
  return { ...rest, root }
}

export const TerminalTabSchema = z.preprocess(
  migrateLegacyTab,
  z.object({
    id: z.string(),
    ordinal: z.number().int(),
    customTitle: z.string().nullable(),
    /** Every pane appears exactly once as a leaf of `root`. */
    root: LayoutNodeSchema,
    /** In creation order. */
    panes: z.array(TerminalPaneSchema).min(1).max(MAX_PANES_PER_TAB),
    activePaneId: z.string(),
  }),
)
export type TerminalTab = z.infer<typeof TerminalTabSchema>

export const WorktreeTerminalLayoutSchema = z.object({
  worktreeId: z.string(),
  tabs: z.array(TerminalTabSchema),
  activeTabId: z.string().nullable(),
})
export type WorktreeTerminalLayout = z.infer<typeof WorktreeTerminalLayoutSchema>
