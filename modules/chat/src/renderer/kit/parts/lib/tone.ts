import { type CHAT_TONES, CHAT_TONE as T } from '../../../../contract'

export type ChatTone = (typeof CHAT_TONES)[number]

/** A soft badge per tone (ui-notes status colours; `accent` = the palette accent). */
export const TONE_BADGE: Record<ChatTone, string> = {
  [T.neutral]: 'border-bd text-mu',
  [T.info]: 'border-info/40 bg-info/10 text-info',
  [T.ok]: 'border-ok/40 bg-ok/10 text-ok',
  [T.warn]: 'border-warn/50 bg-warn/10 text-warn',
  [T.err]: 'border-err/50 bg-err/10 text-err',
  [T.accent]: 'border-act/40 bg-acs text-act',
}

/** A filled status dot per tone. */
export const TONE_DOT: Record<ChatTone, string> = {
  [T.neutral]: 'bg-fa',
  [T.info]: 'bg-info',
  [T.ok]: 'bg-ok',
  [T.warn]: 'bg-warn',
  [T.err]: 'bg-err',
  [T.accent]: 'bg-ac',
}

/** The shared pill shape (status pills, mode badges). */
export const PILL = 'inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 text-[11px] leading-[18px]'
