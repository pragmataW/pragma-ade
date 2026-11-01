import { TerminalTestIds } from '../../contract'

/** The line under a terminal that says why it is not live (exited, gone, failed to start). */
export function StatusBanner({ text }: { text: string }) {
  return (
    <div
      data-testid={TerminalTestIds.status}
      role="status"
      className="border-t border-bd bg-pn px-3 py-1.5 text-[12px] text-mu"
    >
      {text}
    </div>
  )
}
