/** A fake provider's chat UI (composition proof): a custom part, no thinking, its own option picker. */
import type { ChatPartProps, ChatUiDefinition, CustomItem } from '../src/contract'
import { createOptionPicker } from '../src/renderer/kit/controls/OptionPicker'
import { StopButton } from '../src/renderer/kit/controls/StopButton'
import { defaultChatUi } from '../src/renderer/kit/default-ui'
import { useCustomResponse } from '../src/renderer/kit/parts/use-custom-response'
import { FAKE_OPTION_KEY } from './fake-options'

export { FAKE_OPTION_KEY, FAKE_OPTIONS } from './fake-options'

export const FAKE_BANNER_TYPE = 'fake.banner'
export const FAKE_BANNER_TESTID = 'fake-banner'
export const FAKE_REPLY_TESTID = 'fake-banner-reply'

/** Renders `data.message`; an interactive banner (`awaitsResponse`) gets a reply button. */
export function FakeBanner({ item }: ChatPartProps<CustomItem>) {
  const { pending, respond } = useCustomResponse(item)
  const data = item.data as { message: string; reply?: string }
  return (
    <div data-testid={FAKE_BANNER_TESTID}>
      {data.message}
      {pending ? (
        <button type="button" data-testid={FAKE_REPLY_TESTID} onClick={() => void respond({ answer: data.reply })}>
          {data.reply}
        </button>
      ) : null}
    </div>
  )
}

export const fakeChatUi: ChatUiDefinition = {
  ...defaultChatUi,
  parts: { ...defaultChatUi.parts, thinking: undefined, [`custom:${FAKE_BANNER_TYPE}`]: FakeBanner },
  composerToolbar: [createOptionPicker({ key: FAKE_OPTION_KEY }), StopButton],
}
