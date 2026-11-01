import { z } from 'zod'
import { CommandMetaSchema, CommandRefSchema } from './commands'
import { defineIpc, defineIpcEvent } from './ipc'
import { MODULE_KINDS } from './manifest'
import { RectSchema } from './shell'
import { ShortcutSpecSchema } from './shortcuts'
import { ThemeStateSchema } from './theme'

export const MODULE_STATES = ['active', 'disabled', 'failed'] as const
export type ModuleState = (typeof MODULE_STATES)[number]
export const MODULE_STATE_REASONS = [
  'user',
  'missing-dependency',
  'cycle',
  'dependency-disabled',
  'activate-error',
  'migration-error',
] as const
export type ModuleStateReason = (typeof MODULE_STATE_REASONS)[number]
export const MODULE_STATE = { active: 'active', disabled: 'disabled', failed: 'failed' } as const satisfies Record<
  string,
  ModuleState
>
export const MODULE_STATE_REASON = {
  user: 'user',
  missingDependency: 'missing-dependency',
  cycle: 'cycle',
  dependencyDisabled: 'dependency-disabled',
  activateError: 'activate-error',
  migrationError: 'migration-error',
} as const satisfies Record<string, ModuleStateReason>

export const AppInfoSchema = z.object({
  version: z.string(),
  platform: z.string(),
  testMode: z.boolean(),
  languages: z.array(z.string()),
  packaged: z.boolean(),
})
export type AppInfo = z.infer<typeof AppInfoSchema>

export const ModuleStatusSchema = z.object({
  id: z.string(),
  packageName: z.string(),
  version: z.string(),
  kind: z.enum(MODULE_KINDS),
  displayNameKey: z.string(),
  core: z.boolean(),
  dependsOn: z.array(z.string()),
  optionalDependsOn: z.array(z.string()),
  state: z.enum(MODULE_STATES),
  reason: z.enum(MODULE_STATE_REASONS).optional(),
  /** Missing dependency ids, cycle members or the error message. */
  detail: z.string().optional(),
})
export type ModuleStatus = z.infer<typeof ModuleStatusSchema>

export const SetEnabledResultSchema = z.object({ restartRequired: z.boolean(), affected: z.array(z.string()) })
export type SetEnabledResult = z.infer<typeof SetEnabledResultSchema>

export const CommandInfoSchema = CommandMetaSchema.extend({ id: z.string() })
export type CommandInfo = z.infer<typeof CommandInfoSchema>

export const OpenFolderInputSchema = z.object({ titleKey: z.string().optional(), defaultPath: z.string().optional() })
export const OpenFileInputSchema = z.object({
  titleKey: z.string().optional(),
  filters: z.array(z.object({ nameKey: z.string(), extensions: z.array(z.string()) })).optional(),
  multiple: z.boolean().optional(),
})
export const ConfirmInputSchema = z.object({
  titleKey: z.string(),
  messageKey: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
  confirmKey: z.string().optional(),
  cancelKey: z.string().optional(),
  destructive: z.boolean().optional(),
})
export const NotificationInputSchema = z.object({
  titleKey: z.string(),
  bodyKey: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
  onClickCommand: CommandRefSchema.optional(),
})
export type OpenFolderInput = z.infer<typeof OpenFolderInputSchema>
export type OpenFileInput = z.infer<typeof OpenFileInputSchema>
export type ConfirmInput = z.infer<typeof ConfirmInputSchema>
export type NotificationInput = z.infer<typeof NotificationInputSchema>

const folderReply = z.string().nullable()
const filesReply = z.array(z.string()).nullable()
export const DialogStubsSchema = z.object({
  openFolder: z.union([folderReply, z.array(folderReply)]).optional(),
  openFile: z.union([filesReply, z.array(filesReply)]).optional(),
  confirm: z.union([z.boolean(), z.array(z.boolean())]).optional(),
})
export type DialogStubs = z.infer<typeof DialogStubsSchema>

export const OcclusionSchema = z.object({ hide: z.boolean(), snapshot: z.boolean() })
export type Occlusion = z.infer<typeof OcclusionSchema>
export const ViewIdSchema = z.object({ viewId: z.string() })
export const SnapshotSchema = z.object({ viewId: z.string(), bounds: RectSchema, dataUrl: z.string() })
export type NativeSnapshot = z.infer<typeof SnapshotSchema>

export const RendererCommandRequestSchema = z.object({
  requestId: z.string(),
  id: z.string(),
  args: z.unknown().optional(),
})
export const RendererCommandResultSchema = z.object({
  requestId: z.string(),
  ok: z.boolean(),
  value: z.unknown().optional(),
  error: z.string().optional(),
})

const none = z.void()
const sectionValue = z.object({ section: z.string(), value: z.unknown() })

/** All `core.*` channels served by the shell and the main host. */
export const CoreIpc = {
  appInfo: defineIpc({ channel: 'core.app.info', input: none, output: AppInfoSchema }),
  appRelaunch: defineIpc({ channel: 'core.app.relaunch', input: none, output: none }),
  appRendererReady: defineIpc({ channel: 'core.app.rendererReady', input: none, output: none }),
  modulesList: defineIpc({ channel: 'core.modules.list', input: none, output: z.array(ModuleStatusSchema) }),
  modulesSetEnabled: defineIpc({
    channel: 'core.modules.setEnabled',
    input: z.object({ id: z.string(), enabled: z.boolean() }),
    output: SetEnabledResultSchema,
  }),
  settingsGetAll: defineIpc({
    channel: 'core.settings.getAll',
    input: none,
    output: z.record(z.string(), z.unknown()),
  }),
  settingsSet: defineIpc({ channel: 'core.settings.set', input: sectionValue, output: z.unknown() }),
  settingsUpdate: defineIpc({
    channel: 'core.settings.update',
    input: z.object({ section: z.string(), patch: z.unknown() }),
    output: z.unknown(),
  }),
  settingsChanged: defineIpcEvent({ channel: 'core.settings.changed', payload: sectionValue }),
  layoutGet: defineIpc({ channel: 'core.layout.get', input: none, output: z.record(z.string(), z.string()) }),
  layoutSet: defineIpc({
    channel: 'core.layout.set',
    input: z.object({ key: z.string(), value: z.string() }),
    output: none,
  }),
  commandsList: defineIpc({ channel: 'core.commands.list', input: none, output: z.array(CommandInfoSchema) }),
  commandsExecute: defineIpc({ channel: 'core.commands.execute', input: CommandRefSchema, output: z.unknown() }),
  commandsChanged: defineIpcEvent({ channel: 'core.commands.changed', payload: z.array(CommandInfoSchema) }),
  commandsAnnounce: defineIpc({
    channel: 'core.commands.announce',
    input: z.array(CommandInfoSchema),
    output: none,
  }),
  commandsRunInRenderer: defineIpcEvent({
    channel: 'core.commands.runInRenderer',
    payload: RendererCommandRequestSchema,
  }),
  commandsRendererResult: defineIpc({
    channel: 'core.commands.rendererResult',
    input: RendererCommandResultSchema,
    output: none,
  }),
  shortcutsList: defineIpc({ channel: 'core.shortcuts.list', input: none, output: z.array(ShortcutSpecSchema) }),
  shortcutsRegister: defineIpc({ channel: 'core.shortcuts.register', input: ShortcutSpecSchema, output: none }),
  shortcutsUnregister: defineIpc({
    channel: 'core.shortcuts.unregister',
    input: z.object({ id: z.string() }),
    output: none,
  }),
  shortcutsChanged: defineIpcEvent({ channel: 'core.shortcuts.changed', payload: z.array(ShortcutSpecSchema) }),
  themeGet: defineIpc({ channel: 'core.theme.get', input: none, output: ThemeStateSchema }),
  themeChanged: defineIpcEvent({ channel: 'core.theme.changed', payload: ThemeStateSchema }),
  dialogsOpenFolder: defineIpc({
    channel: 'core.dialogs.openFolder',
    input: OpenFolderInputSchema,
    output: folderReply,
  }),
  dialogsOpenFile: defineIpc({ channel: 'core.dialogs.openFile', input: OpenFileInputSchema, output: filesReply }),
  dialogsConfirm: defineIpc({ channel: 'core.dialogs.confirm', input: ConfirmInputSchema, output: z.boolean() }),
  shellOpenExternal: defineIpc({
    channel: 'core.shell.openExternal',
    input: z.object({ url: z.string() }),
    output: none,
  }),
  notificationsShow: defineIpc({ channel: 'core.notifications.show', input: NotificationInputSchema, output: none }),
  testDialogStubsSet: defineIpc({ channel: 'core.test.dialogStubs.set', input: DialogStubsSchema, output: none }),
  nativeViewsBounds: defineIpc({
    channel: 'core.nativeViews.bounds',
    input: z.object({ panelTabId: z.string(), bounds: RectSchema.nullable() }),
    output: none,
  }),
  nativeViewsOcclusion: defineIpc({ channel: 'core.nativeViews.occlusion', input: OcclusionSchema, output: none }),
  nativeViewsFreeze: defineIpc({ channel: 'core.nativeViews.freeze', input: ViewIdSchema, output: none }),
  nativeViewsUnfreeze: defineIpc({ channel: 'core.nativeViews.unfreeze', input: ViewIdSchema, output: none }),
  nativeViewsSnapshot: defineIpcEvent({ channel: 'core.nativeViews.snapshot', payload: SnapshotSchema }),
  nativeViewsSnapshotCleared: defineIpcEvent({ channel: 'core.nativeViews.snapshotCleared', payload: ViewIdSchema }),
} as const
