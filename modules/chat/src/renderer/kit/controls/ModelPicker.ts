import { Cpu } from '@pragma/ui/icons'
import { CHAT_OPTION_KEYS } from '../../../contract'
import { createOptionPicker } from './OptionPicker'

/** The model menu (literal model names from the provider); only the chip icon stays at narrow widths. */
export const ModelPicker = createOptionPicker({ key: CHAT_OPTION_KEYS.model, icon: Cpu })
