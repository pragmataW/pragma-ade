/** Claude chat UI constants (§10.1.5); the custom event type itself lives in `main/chat/constants.ts` (pure). */
export const COMPACT_NOTICE_TESTID = 'claude-compact-boundary'
export const FAST_MODE_TESTID = 'claude-fast-mode'
/** Claude's rewind restores the files only (`rewindFiles`); the kit's user message action asks in these words. */
export const REWIND_I18N = {
  rewind: {
    labelKey: 'claude:chat.rewind.label',
    titleKey: 'claude:chat.rewind.title',
    messageKey: 'claude:chat.rewind.message',
    confirmKey: 'claude:chat.rewind.confirm',
  },
} as const
/** ui-notes: 12–16px line icons, 1.4–1.6px stroke (the kit's toolbar metrics). */
export const ICON_PX = 14
export const ICON_STROKE = 1.5
