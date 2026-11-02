import { CHAT_OPTION_KEYS } from '../../../contract'
import { createOptionPicker } from './OptionPicker'

/** The model menu (literal model names from the provider). */
export const ModelPicker = createOptionPicker({ key: CHAT_OPTION_KEYS.model })
