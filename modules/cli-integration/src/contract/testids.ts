/** `data-testid` values other modules' E2E tests may use (§10.1.6). */
export const CLI_TESTIDS = {
  page: 'cli-settings-page',
  installButton: 'cli-install-button',
  uninstallButton: 'cli-uninstall-button',
  installDirInput: 'cli-install-dir-input',
  status: 'cli-status',
  notOnPath: 'cli-not-on-path',
  bundleMissing: 'cli-bundle-missing',
  error: 'cli-error',
  skillsInstallButton: 'skills-install-button',
  skillsDialog: 'skills-dialog',
  skillsDialogDir: 'skills-dialog-dir',
  skillsDialogProvider: (providerId: string) => `skills-dialog-provider-${providerId}`,
  skillsConfirmButton: 'skills-confirm-button',
  skillsCancelButton: 'skills-cancel-button',
  skillRow: (providerId: string, skillId: string) => `skill-row-${providerId}-${skillId}`,
  skillState: (providerId: string, skillId: string) => `skill-state-${providerId}-${skillId}`,
} as const
