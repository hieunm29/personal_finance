import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'

import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const rawPath = process.env.DATABASE_URL?.replace('file:', '') || './data/app.db'
const dbPath = resolve(rawPath)

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)

// Optimize SQLite for production
sqlite.run('PRAGMA journal_mode = WAL')
sqlite.run('PRAGMA synchronous = NORMAL')
sqlite.run('PRAGMA foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { sqlite }
