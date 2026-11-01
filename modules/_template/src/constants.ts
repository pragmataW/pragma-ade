/** Every literal of the module lives here (§9): ids, channels, commands, shortcuts, sizes. */
export const MODULE_ID = 'example'
export const IPC = {
  hello: 'example.hello',
  addItem: 'example.addItem',
  countItems: 'example.countItems',
  itemAdded: 'example.itemAdded',
} as const
export const COMMANDS = { sayHello: 'example.sayHello' } as const
export const SHORTCUTS = { sayHello: { id: 'example.sayHello', accelerator: 'CmdOrCtrl+Alt+E' } } as const
export const SERVICE_ID = 'example.items'
export const EVENTS = { itemAdded: 'example.itemAdded' } as const
export const TAB_ID = 'example'
export const TAB_ICON = 'sparkles'
export const TAB_ORDER = 1000
/** Out-of-tree settings pages use orders above 1000 (§10.4). */
export const EXAMPLE_SETTINGS_ORDER = 1001
export const SETTINGS_PAGE_ID = 'example'
export const MAX_NAME_LENGTH = 64
export const DEFAULT_NAME = 'World'
export const EXAMPLE_TABLE = 'example_items'
