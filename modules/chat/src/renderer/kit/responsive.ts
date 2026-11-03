/**
 * Container-query classes against the chat view (`@container/chat` on the layout root), so the chat adapts to its
 * own width (docked panels, split views), not the window's. One breakpoint set for the kit and providers' slots:
 * narrow < 480px, compact < 640px.
 */
export const CHAT_RESPONSIVE = {
  /** A toolbar label that collapses at narrow widths (still read by screen readers; the button keeps a tooltip). */
  label: '@max-[479px]/chat:sr-only',
  /** Shown only at narrow widths (an icon or short form standing in for a collapsed label). */
  narrowOnly: 'hidden @max-[479px]/chat:inline-block',
  /** A long label (model name) that truncates sooner at compact widths. */
  compactLabel: 'truncate @max-[639px]/chat:max-w-24',
  /** Hidden at narrow widths (secondary meta). */
  wideOnly: '@max-[479px]/chat:hidden',
} as const
