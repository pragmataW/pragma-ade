/** Electron fuses phase 12 flips at packaging time (§10.1.8): pty-daemon, hooks and the CLI shim run Electron as Node. */
export const ELECTRON_FUSES = { runAsNode: true, enableNodeCliInspectArguments: true } as const
