import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { describe, expect, it } from 'vitest'
import type { ChatProviderSettingsProps } from '../../src/contract'
import { defaultChatUi } from '../../src/renderer/kit/default-ui'
import { providerSettingsPages } from '../../src/renderer/view/ProviderSettingsPage'
import { renderChat } from './support'

function Probe({ providerId, call }: ChatProviderSettingsProps) {
  return (
    <button type="button" onClick={() => void call({ op: 'list' })}>
      {providerId}
    </button>
  )
}

const page = { titleKey: 'prov:settings.title', icon: 'plug', component: Probe }
const identity = (c: ComponentType) => c

describe('providerSettingsPages', () => {
  it('one page per provider with a settingsPage, ordered after Settings › Chat', () => {
    const pages = providerSettingsPages(
      [
        { id: 'a', chatUi: defaultChatUi },
        { id: 'b', chatUi: { ...defaultChatUi, settingsPage: page } },
        { id: 'c', chatUi: undefined },
      ],
      identity,
    )
    expect(pages.map((p) => [p.id, p.titleKey, p.icon])).toEqual([['chat.provider.b', 'prov:settings.title', 'plug']])
    expect(pages[0]?.order).toBeGreaterThan(120)
  })

  it('the page body calls chat.providerCall with its provider id', async () => {
    const [p] = providerSettingsPages([{ id: 'b', chatUi: { ...defaultChatUi, settingsPage: page } }], identity)
    const Page = p?.component ?? (() => null)
    const { host } = renderChat(<Page />)
    await userEvent.click(screen.getByRole('button', { name: 'b' }))
    expect(host.calls.filter((c) => c.method === 'providerCall').map((c) => c.args)).toEqual([['b', { op: 'list' }]])
  })
})
