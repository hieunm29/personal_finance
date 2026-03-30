import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

function resolveDefaultDbPath() {
  return resolve(import.meta.dir, '../../data/app.db')
}

function ensureLegacyColumns(sqlite: Database) {
  const userProfilesTable = sqlite
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_profiles'")
    .get() as { name: string } | null

  if (!userProfilesTable) {
    return
  }

  const userProfileColumns = sqlite
    .query("PRAGMA table_info('user_profiles')")
    .all() as Array<{ name: string }>

  const hasGoldPricePerLuong = userProfileColumns.some((column) => column.name === 'gold_price_per_luong')

  if (!hasGoldPricePerLuong) {
    sqlite.run('ALTER TABLE user_profiles ADD COLUMN gold_price_per_luong integer')
  }
}

const rawPath = process.env.DATABASE_URL?.replace('file:', '') || resolveDefaultDbPath()
const dbPath = resolve(rawPath)

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)

// Optimize SQLite for production
sqlite.run('PRAGMA journal_mode = WAL')
sqlite.run('PRAGMA synchronous = NORMAL')
sqlite.run('PRAGMA foreign_keys = ON')
sqlite.run('PRAGMA busy_timeout = 5000')

ensureLegacyColumns(sqlite)

export const db = drizzle(sqlite, { schema })
export { sqlite }
