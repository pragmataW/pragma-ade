import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { WebContentsView } from 'electron'
import type { Disposable } from '../../common/disposable'
import { APP_DIR_NAMES } from '../../constants'
import type { NativeViewsApi } from '../../main/native-views'
import type { MainContext, ModuleSettingsApi } from '../../main/types'
import type { CommandRegistry } from '../shared/command-registry'
import type { HostCore } from './host-core'
import type { NativeViewLike } from './native-view-host'
import type { ModuleRecord } from './types'

export interface BuiltContext {
  ctx: MainContext
  disposables: Disposable[]
}

/** Adapts a WebContentsView to the host's view interface; `native` is what the shell container adds. */
export function adaptView(view: WebContentsView): NativeViewLike & { native: WebContentsView } {
  return {
    native: view,
    setBounds: (r) => view.setBounds(r),
    setVisible: (v) => view.setVisible(v),
    capture: async () => (await view.webContents.capturePage()).toDataURL(),
  }
}

export function hostPaths(core: HostCore) {
  return {
    userData: core.userDataDir,
    logs: join(core.userDataDir, APP_DIR_NAMES.logs),
    temp: join(tmpdir(), APP_DIR_NAMES.temp),
    resource: (moduleId: string, relPath: string) => core.resources.resource(moduleId, relPath),
  }
}

function settingsApi(core: HostCore, id: string, track: <T extends Disposable>(d: T) => T): ModuleSettingsApi<unknown> {
  return {
    get: () => core.settings.get(id),
    set: (v) => core.settings.set(id, v),
    update: (p) => core.settings.update(id, p),
    onChange: (cb) => track(core.settings.onChange(id, (v) => cb(v))),
    read: <U>(moduleId: string) => core.settings.get<U>(moduleId),
  }
}

function trackedCommands(commands: CommandRegistry, track: <T extends Disposable>(d: T) => T): CommandRegistry {
  return { ...commands, register: (idOrDef, handler, meta) => track(commands.register(idOrDef, handler, meta)) }
}

function nativeViewsApi(core: HostCore, track: <T extends Disposable>(d: T) => T): NativeViewsApi {
  const host = core.nativeViews
  return {
    attach: (viewId, view, opts) => track(host.attach(viewId, adaptView(view), opts)),
    detach: (viewId) => host.detach(viewId),
    show: (viewId) => host.show(viewId),
    hide: (viewId) => host.hide(viewId),
    freeze: (viewId) => host.freeze(viewId),
    unfreeze: (viewId) => host.unfreeze(viewId),
  }
}

/** Builds `ctx` for one module; every registration is tracked so a failed module can be rolled back. */
export function createModuleContext(core: HostCore, record: ModuleRecord): BuiltContext {
  const id = record.manifest.id
  const disposables: Disposable[] = []
  const track = <T extends Disposable>(d: T): T => {
    disposables.push(d)
    return d
  }
  const dataDir = join(core.userDataDir, APP_DIR_NAMES.modules, id)
  mkdirSync(dataDir, { recursive: true })
  const ctx: MainContext = {
    module: { id, version: record.version, paths: { root: record.dir, data: dataDir } },
    db: core.database.db,
    settings: settingsApi(core, id, track),
    events: { emit: core.events.emit, on: (def, cb) => track(core.events.on(def, cb)) },
    ipc: {
      handle: (c, h) => track(core.router.handle(c, h, id)),
      publish: (c, payload) => core.router.publish(c, payload),
    },
    services: core.services.scope(id, {
      required: record.manifest.dependsOn,
      optional: record.manifest.optionalDependsOn,
    }),
    commands: trackedCommands(core.commands, track),
    shortcuts: { register: (spec) => track(core.shortcuts.register(spec)) },
    providers: core.providers.api(),
    nativeViews: nativeViewsApi(core, track),
    dialogs: core.platformApis.dialogs,
    shell: core.platformApis.shell,
    notifications: core.platformApis.notifications,
    theme: { get: core.theme.get, onChange: (cb) => track(core.theme.onChange(cb)) },
    env: core.platformApis.env,
    window: core.platformApis.window,
    paths: hostPaths(core),
    log: core.log.child(id),
    i18n: core.i18n,
    testMode: core.testMode,
  }
  return { ctx, disposables }
}
