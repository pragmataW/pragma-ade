/** `data-testid` values and data attributes other modules' E2E tests may use (§10.1.6). */
export const AGENT_STATUS_TEST_IDS = {
  icon: 'agent-status-icon',
  worktreeBadge: 'agent-status-worktree-badge',
  unread: 'agent-status-unread',
  tabBadge: 'agent-status-tab-badge',
  cardBadge: 'agent-status-card-badge',
  statusbarCounts: 'agent-status-statusbar-counts',
  statusbarWorking: 'agent-status-statusbar-working',
  statusbarWaiting: 'agent-status-statusbar-waiting',
  settingsNotifications: 'agent-status-settings-notifications',
  settingsIdleSeconds: 'agent-status-settings-idle-seconds',
} as const

export const AGENT_STATUS_DATA_ATTRS = {
  status: 'data-status',
  visual: 'data-visual',
  sessionId: 'data-session-id',
  worktreeId: 'data-worktree-id',
} as const
