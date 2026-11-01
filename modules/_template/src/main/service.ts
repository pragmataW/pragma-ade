import type { PragmaDb } from '@pragma/sdk/db'
import { count } from '@pragma/sdk/db'
import type { ExampleService, ItemAdded } from '../contract'
import { exampleItems } from './schema'

/** Stores items and reports each addition through `onAdded`. */
export function createExampleService(db: PragmaDb, onAdded: (e: ItemAdded) => void): ExampleService {
  const service: ExampleService = {
    add(label) {
      const item = db.insert(exampleItems).values({ label }).returning().get()
      onAdded({ item, total: service.count() })
      return item
    },
    count: () => db.select({ n: count() }).from(exampleItems).get()?.n ?? 0,
  }
  return service
}
