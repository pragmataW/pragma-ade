/** Module and provider ids: lowercase kebab-case. */
export const MODULE_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
/** Migration file names: `NNNN_name.sql`, ordered within the module only (§10.1.4). */
export const MIGRATION_NAME_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/
/** IPC channels: `<module-id>.<action>[.<action>…]`. */
export const IPC_CHANNEL_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-zA-Z0-9]*)+$/
/** Fully qualified i18n keys: `<namespace>:<section>.<key>`. */
export const I18N_KEY_PATTERN = /^[a-z][a-z0-9-]*:[A-Za-z0-9_.-]+$/
/** Capability files: `<key>.capability.ts` (main) or `<key>.capability.tsx` (renderer). */
export const CAPABILITY_FILE_PATTERN = /^(?<key>[a-z][a-zA-Z0-9]*)\.capability\.tsx?$/
/** Service tokens and other module-scoped ids: `<module-id>.<name>`. */
export const SCOPED_ID_PATTERN = /^(?<moduleId>[a-z][a-z0-9-]*)\.[A-Za-z][A-Za-z0-9.]*$/
