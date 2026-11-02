/** OpenCode chat UI constants (§10.1.5, phase 11b): test ids shared with this provider's E2E. */
export const OPENCODE_CHAT_TESTIDS = {
  form: 'opencode-form',
  formField: (key: string) => `opencode-form-field-${key}`,
  formOption: (key: string, value: string) => `opencode-form-option-${key}-${value}`,
  formCustom: (key: string) => `opencode-form-custom-${key}`,
  formSubmit: 'opencode-form-submit',
  formCancel: 'opencode-form-cancel',
  formOutcome: 'opencode-form-outcome',
  retry: 'opencode-retry',
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
export const RETRY_TITLE_KEY = 'opencode:chatUi.retry.title'
