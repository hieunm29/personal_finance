import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const migrationDirectory = join(import.meta.dir, 'migrations')

function columns(database: Database, table: string): Set<string> {
  return new Set((database.query(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(column => column.name))
}

/** Preserve columns added manually by the MVP, without changing migration files. */
function prepareLegacyMigration(database: Database, source: string): string {
  let prepared = source.replace(/PRAGMA\s+foreign_keys\s*=\s*(?:OFF|ON)\s*;/gi, '')
  prepared = prepared.replace(/ALTER TABLE\s+`(\w+)`\s+ADD(?: COLUMN)?\s+`(\w+)`[^;]*;/gi, (statement, table, column) =>
    columns(database, table).has(column) ? '' : statement,
  )
  prepared = prepared.replace(/INSERT INTO\s+`(\w+_new)`\s*\(([^)]+)\)\s*SELECT\s+([^;]+?)\s+FROM\s+`(\w+)`\s*;/g,
    (statement, target, targetList, sourceList, table) => {
      const existing = columns(database, table)
      const names = targetList.split(',').map((name: string) => name.trim().replaceAll('`', ''))
      const expressions = sourceList.split(',').map((expression: string) => expression.trim())
      if (names.length !== expressions.length) throw new Error(`Cannot adapt migration copy for ${table}`)
      for (const name of ['asset_id', 'recurring_template_id']) {
        const index = names.indexOf(name)
        if (index >= 0 && expressions[index].toUpperCase() === 'NULL' && existing.has(name)) expressions[index] = `\`${name}\``
      }
      return `INSERT INTO \`${target}\` (${targetList}) SELECT ${expressions.join(', ')} FROM \`${table}\`;`
    },
  )
  return prepared
}

export function runMigrations(databasePath: string) {
  mkdirSync(dirname(databasePath), { recursive: true })
  const database = new Database(databasePath)
  const applied: string[] = []
  const adopted: string[] = []
  database.run('PRAGMA busy_timeout = 5000')
  database.run('PRAGMA foreign_keys = OFF')
  try {
    database.transaction(() => {
      database.run('CREATE TABLE IF NOT EXISTS _pf_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
      const files = readdirSync(migrationDirectory).filter(name => /^\d+_.+\.sql$/.test(name)).sort()
      const baseline = readFileSync(join(migrationDirectory, files[0]), 'utf8')
      const baselineTables = [...baseline.matchAll(/CREATE TABLE\s+`([^`]+)`/g)].map(match => match[1])
      const existingTables = new Set((database.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(row => row.name))
      const legacy = baselineTables.some(table => existingTables.has(table)) && !database.query('SELECT name FROM _pf_migrations LIMIT 1').get()
      if (legacy && !baselineTables.every(table => existingTables.has(table))) throw new Error('Legacy database is missing baseline tables; migration was rolled back.')
      for (const file of files) {
        const source = readFileSync(join(migrationDirectory, file), 'utf8')
        const hash = createHash('sha256').update(source).digest('hex')
        const entry = database.query('SELECT hash FROM _pf_migrations WHERE name = ?').get(file) as { hash: string } | null
        if (entry) {
          if (entry.hash !== hash) throw new Error(`Applied migration was changed: ${file}`)
          continue
        }
        const alreadyPresent = legacy && (file === files[0] || (file === '0001_sticky_maverick.sql' && columns(database, 'user_profiles').has('gold_price_per_luong')))
        if (alreadyPresent) adopted.push(file)
        else {
          const sql = file === '0002_transaction_asset_references.sql' ? prepareLegacyMigration(database, source) : source
          for (const chunk of sql.split('--> statement-breakpoint').map(part => part.trim()).filter(Boolean)) database.exec(chunk)
          applied.push(file)
        }
        database.query('INSERT INTO _pf_migrations (name, hash) VALUES (?, ?)').run(file, hash)
      }
      if (database.query('PRAGMA foreign_key_check').all().length > 0) throw new Error('Foreign key verification failed; migration was rolled back.')
    })()
  } finally {
    database.run('PRAGMA foreign_keys = ON')
    database.close()
  }
  return { applied, adopted }
}

if (import.meta.main) {
  const path = process.env.DATABASE_URL?.replace(/^file:/, '') ?? resolve(import.meta.dir, '../../data/app.db')
  console.log(JSON.stringify(runMigrations(resolve(path))))
}
