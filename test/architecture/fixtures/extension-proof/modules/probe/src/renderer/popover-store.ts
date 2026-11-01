type Listener = () => void

/** Open state of the test-only snapshot popover, toggled by the `probe.openSnapshotPopover` command. */
export function createPopoverStore() {
  let open = false
  const listeners = new Set<Listener>()
  return {
    get: () => open,
    set(next: boolean) {
      open = next
      for (const l of listeners) l()
    },
    subscribe(l: Listener) {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
  }
}
export type PopoverStore = ReturnType<typeof createPopoverStore>
