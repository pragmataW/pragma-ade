/** OpenCode chat UI constants (§10.1.5, phase 11b): test ids shared with this provider's E2E. */
export const OPENCODE_CHAT_TESTIDS = {
  form: 'opencode-form',
  formField: (key: string) => `opencode-form-field-${key}`,
  formOption: (key: string, value: string) => `opencode-form-option-${key}-${value}`,
  formCustom: (key: string) => `opencode-form-custom-${key}`,
  formSubmit: 'opencode-form-submit',
  formCancel: 'opencode-form-cancel',
  formOutcome: 'opencode-form-outcome',
  notice: 'opencode-notice',
  modelPicker: 'opencode-model-picker',
  modelOption: (value: string) => `opencode-model-option-${value}`,
  manageProviders: 'opencode-manage-providers',
  reauth: 'opencode-reauth',
  providers: 'opencode-providers',
  providerRow: (id: string) => `opencode-provider-${id}`,
  providerConnect: (id: string) => `opencode-provider-connect-${id}`,
  providerKeyInput: 'opencode-provider-key',
  providerKeySave: 'opencode-provider-key-save',
  providerRemove: (id: string) => `opencode-provider-remove-${id}`,
  providerSearch: 'opencode-provider-search',
  providerError: 'opencode-provider-error',
  providerOauth: 'opencode-provider-oauth',
} as const

/** The radio value that switches a `custom` string field to free text. */
export const CUSTOM_CHOICE = '__custom__'
export const FORM_I18N = {
  submit: 'opencode:chatUi.form.submit',
  cancel: 'opencode:chatUi.form.cancel',
  custom: 'opencode:chatUi.form.custom',
  required: 'opencode:chatUi.form.required',
  outcome: { answered: 'opencode:chatUi.form.answered', cancelled: 'opencode:chatUi.form.cancelled' },
} as const
export const NOTICE_I18N = {
  reverted: 'opencode:chatUi.notice.reverted',
  files: 'opencode:chatUi.notice.files',
  forked: 'opencode:chatUi.notice.forked',
  forkedFrom: 'opencode:chatUi.notice.forkedFrom',
} as const
export const MODEL_I18N = {
  search: 'opencode:chatUi.model.search',
  empty: 'opencode:chatUi.model.empty',
  other: 'opencode:chatUi.model.other',
  none: 'opencode:chatUi.model.none',
  manage: 'opencode:chatUi.model.manage',
} as const
/** Rewind (files and conversation) and fork copy of the kit's user message actions. */
export const USER_MESSAGE_I18N = {
  rewind: {
    labelKey: 'opencode:chatUi.message.rewind',
    titleKey: 'opencode:chatUi.message.rewindTitle',
    messageKey: 'opencode:chatUi.message.rewindMessage',
    confirmKey: 'opencode:chatUi.message.rewindConfirm',
  },
  fork: { labelKey: 'opencode:chatUi.message.fork' },
} as const
export const ERROR_I18N = {
  reauthHint: 'opencode:chatUi.error.reauthHint',
  reauthAction: 'opencode:chatUi.error.reauthAction',
} as const
const CONNECTIONS = 'opencode:chatUi.connections.'
export const CONNECTIONS_I18N = {
  title: `${CONNECTIONS}title`,
  heading: `${CONNECTIONS}heading`,
  intro: `${CONNECTIONS}intro`,
  search: `${CONNECTIONS}search`,
  loading: `${CONNECTIONS}loading`,
  loadFailed: `${CONNECTIONS}loadFailed`,
  connected: `${CONNECTIONS}connected`,
  available: `${CONNECTIONS}available`,
  more: `${CONNECTIONS}more`,
  notConnected: `${CONNECTIONS}notConnected`,
  free: `${CONNECTIONS}free`,
  env: `${CONNECTIONS}env`,
  remove: `${CONNECTIONS}remove`,
  removeTitle: `${CONNECTIONS}removeTitle`,
  removeMessage: `${CONNECTIONS}removeMessage`,
  removeConfirm: `${CONNECTIONS}removeConfirm`,
  keyLabel: `${CONNECTIONS}keyLabel`,
  keyPlaceholder: `${CONNECTIONS}keyPlaceholder`,
  save: `${CONNECTIONS}save`,
  cancel: `${CONNECTIONS}cancel`,
  oauthOpen: `${CONNECTIONS}oauthOpen`,
  oauthWaiting: `${CONNECTIONS}oauthWaiting`,
  oauthCode: `${CONNECTIONS}oauthCode`,
  oauthComplete: `${CONNECTIONS}oauthComplete`,
  oauthFailed: `${CONNECTIONS}oauthFailed`,
  noticePrefix: `${CONNECTIONS}notice.`,
} as const
export const SETTINGS_ICON = 'plug'
/** Unconnected providers listed before "N more — search" (OpenCode knows hundreds). */
export const MAX_AVAILABLE_ROWS = 40
export const OAUTH_POLL_MS = 2000
export const INPUT_PASSWORD = 'password'
/** Electron's wrapper around a rejected IPC call ("Error invoking remote method 'x': Error: …"). */
export const IPC_ERROR_PREFIX_RE = /^Error invoking remote method '[^']+': (?:\w*Error: )?/
/** Errors whose message is an `opencode:` i18n key (startup reasons, server exit) are translated with `{detail}`. */
export const OPENCODE_KEY_PREFIX = 'opencode:'
export const ICON_PX = 14
export const ICON_STROKE = 1.5
export const SIZE_SM = 'sm'
export const SIZE_ICON_XS = 'icon-xs'
export const VARIANT_GHOST = 'ghost'
export const VARIANT_OUTLINE = 'outline'
export const ALIGN_START = 'start'
export const BUTTON_TYPE = 'button'
export const ROLE = { status: 'status', alert: 'alert' } as const
export const AGENT_OPTION = 'agent'
