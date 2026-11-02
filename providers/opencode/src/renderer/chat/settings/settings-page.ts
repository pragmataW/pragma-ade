import { CONNECTIONS_I18N, SETTINGS_ICON } from '../constants'
import { ProvidersPage } from './ProvidersPage'

/** Settings › OpenCode (`chatUi.settingsPage`): model provider connections. */
export const opencodeSettingsPage = {
  titleKey: CONNECTIONS_I18N.title,
  icon: SETTINGS_ICON,
  component: ProvidersPage,
}
