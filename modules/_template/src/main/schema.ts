import { integer, sqliteTable, text } from '@pragma/sdk/db'
import { EXAMPLE_TABLE } from '../constants'

/** Drizzle view of the table created by `migrations/0001_example_items.sql`. */
export const exampleItems = sqliteTable(EXAMPLE_TABLE, {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
})
