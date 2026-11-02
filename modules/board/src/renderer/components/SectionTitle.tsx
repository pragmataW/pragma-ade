/** Drawer section label (ui-notes: 11px / 600 / uppercase / 0.06em). */
export function SectionTitle({ children }: { children: string }) {
  return <h3 className="font-semibold text-[11px] text-[var(--mu)] uppercase tracking-[0.06em]">{children}</h3>
}
