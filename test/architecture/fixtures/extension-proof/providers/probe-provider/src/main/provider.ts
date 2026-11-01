import { defineProvider } from '@pragma/sdk'
import { DEFAULT_COMMAND, PROVIDER_ID } from '../constants'

export default defineProvider({
  id: PROVIDER_ID,
  displayNameKey: `${PROVIDER_ID}:provider.name`,
  icon: PROVIDER_ID,
  defaultCommand: DEFAULT_COMMAND,
  defaultArgs: [],
})
