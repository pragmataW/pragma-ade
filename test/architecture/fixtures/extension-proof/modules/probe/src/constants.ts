export const PROBE_ID = 'probe'
export const PROBE_TAB_ORDER = 900
export const PROBE_BADGE_COUNT = 3
export const PROBE_INSET_TOP_PX = 24
export const PROBE_VIEW_ID = 'probe.view'
export const PROBE_SLOT_ID = 'probe.slot'
export const PROBE_TAB_ICON = 'flask-conical'
export const PROBE_GREETING = 'hello'
export const PING_CAPABILITY = 'ping'
export const BADGE_CAPABILITY = 'badge'
export const BUILD_MARKER = 'assets/marker.txt'
export const PROBE_VIEW_URL = 'about:blank'
export const PROBE_COMMANDS = {
  openSnapshotPopover: 'probe.openSnapshotPopover',
  freeze: 'probe.freeze',
  unfreeze: 'probe.unfreeze',
} as const
/** Only the test hook checks the fixture provider's dispose marker; production code never names a provider. */
export const PROBE_PROVIDER_ID = 'probe-provider'
export const DISPOSED_MARKER = 'disposed.txt'
