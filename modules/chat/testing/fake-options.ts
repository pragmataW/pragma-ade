import { type ChatOptionDescriptor, OPTION_TYPE } from '../src/contract'

export const FAKE_OPTION_KEY = 'fakeMode'
/** A provider-specific option (`fakeMode`: a | b) for composition tests. */
export const FAKE_OPTIONS: ChatOptionDescriptor[] = [
  {
    key: FAKE_OPTION_KEY,
    type: OPTION_TYPE.enum,
    labelKey: 'chat:option.model',
    values: [
      { value: 'a', label: 'Mode A' },
      { value: 'b', label: 'Mode B' },
    ],
    default: 'a',
    current: 'a',
  },
]
