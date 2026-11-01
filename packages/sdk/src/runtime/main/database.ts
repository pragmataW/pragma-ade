import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { BUSY_TIMEOUT_MS } from '../../constants'
import type { PragmaDb } from '../../db/index'

export type SqliteDatabase = Database.Database

export interface OpenedDatabase {
  sqlite: SqliteDatabase
  db: PragmaDb
  close(): void
}

export function openDatabase(file: string): OpenedDatabase {
  mkdirSync(dirname(file), { recursive: true })
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`)
  return { sqlite, db: drizzle(sqlite), close: () => sqlite.close() }
}
