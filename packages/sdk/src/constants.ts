export const SLUG_MAX_LENGTH = 48

export const PLATFORM = { darwin: 'darwin', linux: 'linux', win32: 'win32' } as const

/** Module id of shell-provided services, IPC channels and commands. */
export const CORE_MODULE_ID = 'core'

export const CAPABILITY_KIND = 'capability'
export const SIDES = { main: 'main', renderer: 'renderer' } as const

export const SHORTCUT_SCOPE = { global: 'global', app: 'app' } as const
