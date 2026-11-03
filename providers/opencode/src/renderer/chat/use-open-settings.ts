import { type ChatHost, PROVIDER_SETTINGS_PAGE_PREFIX } from '@pragma/module-chat/contract'
import { CoreCommands } from '@pragma/sdk'
import { PROVIDER_ID } from '../../constants'

/** This provider's Settings page (`chatUi.settingsPage`, registered by the chat module). */
export const PROVIDER_SETTINGS_PAGE_ID = `${PROVIDER_SETTINGS_PAGE_PREFIX}${PROVIDER_ID}`

/** Opens Settings › OpenCode (provider connections); null when the shell offers no settings command. */
export function useOpenProviderSettings(host: Pick<ChatHost, 'commands'>): (() => void) | null {
  if (!host.commands.has(CoreCommands.openSettings)) return null
  return () => void host.commands.execute(CoreCommands.openSettings, { pageId: PROVIDER_SETTINGS_PAGE_ID })
}
