import { SETTINGS_PAGE_ORDER } from '@pragma/sdk'
import type { SettingsPage } from '@pragma/sdk/renderer'
import { type ComponentType, useCallback } from 'react'
import { PROVIDER_PAGE_ORDER_STEP } from '../../constants'
import { type ChatProviderSettingsPage, type ChatUiDefinition, PROVIDER_SETTINGS_PAGE_PREFIX } from '../../contract'
import { useChatHost } from '../host-adapter'

/** A provider's settings page body, given its `chat.providerCall` RPC. */
export function ProviderSettingsBody({ providerId, page }: { providerId: string; page: ChatProviderSettingsPage }) {
  const host = useChatHost()
  const call = useCallback((request: unknown) => host.providerCall(providerId, request), [host, providerId])
  const Body = page.component
  return <Body providerId={providerId} call={call} />
}

/** Settings pages of every provider whose `chatUi` declares one (after Settings › Chat, in provider order). */
export function providerSettingsPages(
  providers: { id: string; chatUi: ChatUiDefinition | undefined }[],
  wrap: (c: ComponentType) => ComponentType,
): SettingsPage[] {
  return providers.flatMap(({ id, chatUi }, i) => {
    const page = chatUi?.settingsPage
    if (!page) return []
    // biome-ignore lint/correctness/noComponentHookFactories: one page component per provider, built once at activation
    const Page = () => <ProviderSettingsBody providerId={id} page={page} />
    Page.displayName = `ProviderSettings(${id})`
    return [
      {
        id: `${PROVIDER_SETTINGS_PAGE_PREFIX}${id}`,
        titleKey: page.titleKey,
        order: SETTINGS_PAGE_ORDER.chat + (i + 1) * PROVIDER_PAGE_ORDER_STEP,
        ...(page.icon ? { icon: page.icon } : {}),
        component: wrap(Page),
      },
    ]
  })
}
