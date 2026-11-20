import { describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runMigrations } from './migrate'

function withTemporaryDatabase(run: (path: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'pf-migration-test-'))
  try { run(join(directory, 'app.db')) } finally { rmSync(directory, { recursive: true, force: true }) }
}

function legacyDatabase(path: string) {
  const database = new Database(path)
  database.exec(readFileSync(join(import.meta.dir, 'migrations/0000_same_reavers.sql'), 'utf8'))
  database.run('ALTER TABLE transactions ADD COLUMN asset_id text')
  database.run("INSERT INTO user_profiles (id,auth_user_id) VALUES ('profile','auth')")
  database.run("INSERT INTO category_groups (id,user_id,name,type) VALUES ('group','profile','Expense','expense')")
  database.run("INSERT INTO categories (id,user_id,group_id,name,type) VALUES ('category','profile','group','Food','expense')")
  database.run("INSERT INTO wallets (id,user_id,name,type) VALUES ('wallet','profile','Cash','cash')")
  database.run("INSERT INTO assets (id,user_id,name,type,current_value) VALUES ('asset','profile','Bank','bank',90000)")
  database.run("INSERT INTO transactions (id,user_id,type,amount,category_id,wallet_id,asset_id,date,note) VALUES ('transaction','profile','expense',1000,'category','wallet','asset','2026-10-25','Keep this note')")
  database.close()
}

describe('database migration runner', () => {
  test('creates a fresh schema and repeated runs are idempotent', () => withTemporaryDatabase(path => {
    const initial = runMigrations(path)
    expect(initial.applied).toContain('0002_transaction_asset_references.sql')
    expect(runMigrations(path)).toEqual({ applied: [], adopted: [] })
    const database = new Database(path)
    expect(database.query('PRAGMA foreign_key_check').all()).toEqual([])
    const names = (database.query('PRAGMA table_info(transactions)').all() as { name: string }[]).map(row => row.name)
    expect(names).toContain('asset_id')
    expect(names).toContain('recurring_template_id')
    database.close()
  }))

  test('adopts an unjournaled database and preserves existing bank references', () => withTemporaryDatabase(path => {
    legacyDatabase(path)
    const result = runMigrations(path)
    expect(result.adopted).toContain('0000_same_reavers.sql')
    const database = new Database(path)
    expect(database.query('SELECT asset_id, amount, note FROM transactions WHERE id = ?').get('transaction')).toEqual({ asset_id: 'asset', amount: 1000, note: 'Keep this note' })
    expect(database.query('SELECT current_value FROM assets WHERE id = ?').get('asset')).toEqual({ current_value: 90000 })
    expect(database.query('PRAGMA foreign_key_check').all()).toEqual([])
    database.close()
    expect(runMigrations(path)).toEqual({ applied: [], adopted: [] })
  }))

  test('rolls back rather than accepting broken foreign keys', () => withTemporaryDatabase(path => {
    legacyDatabase(path)
    const before = new Database(path)
    before.run("UPDATE transactions SET category_id = 'missing-category'")
    before.close()
    expect(() => runMigrations(path)).toThrow('Foreign key verification failed')
    const after = new Database(path)
    const names = (after.query('PRAGMA table_info(transactions)').all() as { name: string }[]).map(row => row.name)
    expect(names).not.toContain('recurring_template_id')
    expect(after.query("SELECT name FROM sqlite_master WHERE name = '_pf_migrations'").get()).toBeNull()
    after.close()
  }))
})
