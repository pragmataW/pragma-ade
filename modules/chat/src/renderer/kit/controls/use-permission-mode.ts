import {
  CHAT_OPTION_KEYS,
  type ChatOptionChoice,
  type ChatOptionDescriptor,
  type ChatSessionApi,
  nextCycleChoice,
} from '../../../contract'
import { useChatHost } from '../../host-adapter'
import { useChoiceLabel } from './use-choice-label'

const CONFIRM = {
  titleKey: 'chat:permissionMode.confirmTitle',
  messageKey: 'chat:permissionMode.confirmMessage',
  confirmKey: 'chat:permissionMode.confirm',
} as const

/** The session's `permissionMode` descriptor (provider-described), if any. */
export const permissionModeOf = (session: ChatSessionApi): ChatOptionDescriptor | undefined =>
  session.transcript.info.options.find((o) => o.key === CHAT_OPTION_KEYS.permissionMode)

/** True when `choice` may be used: a `requiresConfirm` choice first asks through the SDK confirm dialog. */
export function useModeConfirm() {
  const host = useChatHost()
  const label = useChoiceLabel()
  return async (choice: ChatOptionChoice): Promise<boolean> =>
    !choice.requiresConfirm ||
    host.confirm({ ...CONFIRM, params: { mode: label(choice) }, destructive: choice.dangerous })
}

/** Selects a mode (after confirmation when the choice requires it). */
export function usePermissionModeSelect(session: ChatSessionApi) {
  const confirm = useModeConfirm()
  return async (d: ChatOptionDescriptor, choice: ChatOptionChoice): Promise<void> => {
    if (choice.value === d.current || !(await confirm(choice))) return
    await session.setOption(d.key, choice.value)
  }
}

/** Shift+Tab in the composer: the next mode of the cycle (`cycle: false` choices are skipped). */
export function usePermissionModeCycle(session: ChatSessionApi) {
  const select = usePermissionModeSelect(session)
  const d = permissionModeOf(session)
  const next = d ? nextCycleChoice(d) : undefined
  return {
    available: next !== undefined,
    next: () => (d && next ? select(d, next) : Promise.resolve()),
  }
}
