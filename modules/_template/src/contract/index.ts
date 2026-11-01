import { createServiceToken, defineEvent, defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { EVENTS, IPC, SERVICE_ID } from '../constants'
import {
  AddItemInputSchema,
  CountSchema,
  HelloInputSchema,
  HelloOutputSchema,
  type Item,
  type ItemAdded,
  ItemAddedSchema,
  ItemSchema,
} from './schemas'

/** Renderer ↔ main channels (`example.*`); `itemAdded` is main → renderer (`ctx.ipc.publish`). */
export const ExampleIpc = {
  hello: defineIpc({ channel: IPC.hello, input: HelloInputSchema, output: HelloOutputSchema }),
  addItem: defineIpc({ channel: IPC.addItem, input: AddItemInputSchema, output: ItemSchema }),
  countItems: defineIpc({ channel: IPC.countItems, input: z.void(), output: CountSchema }),
  itemAdded: defineIpcEvent({ channel: IPC.itemAdded, payload: ItemAddedSchema }),
} as const

/** Main-side service other modules can use (they list `example` in `dependsOn`). */
export interface ExampleService {
  add(label: string): Item
  count(): number
}
export const ExampleServiceToken = createServiceToken<ExampleService>(SERVICE_ID)

/** Main-process event (`ctx.events`), emitted after an item is stored. */
export const ExampleItemAdded = defineEvent<ItemAdded>(EVENTS.itemAdded)

export * from './schemas'
export { TEST_IDS } from './testids'
