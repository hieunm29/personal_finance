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

  test('converts balance-less wallets into cash assets and keeps bank references', () => withTemporaryDatabase(path => {
    legacyDatabase(path)
    const setup = new Database(path)
    // Giao dịch chỉ gắn ví (không có asset) → phải chuyển sang tài sản tiền mặt mới.
    setup.run("INSERT INTO transactions (id,user_id,type,amount,category_id,wallet_id,date) VALUES ('cash-only','profile','expense',500,'category','wallet','2026-10-26')")
    setup.close()
    runMigrations(path)
    const database = new Database(path)
    const cash = database.query("SELECT id, name, current_value FROM assets WHERE type = 'cash'").all() as { id: string; name: string; current_value: number }[]
    expect(cash).toHaveLength(1)
    expect(cash[0].name).toBe('Cash')
    expect(cash[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(database.query("SELECT asset_id, wallet_id FROM transactions WHERE id = 'cash-only'").get()).toEqual({ asset_id: cash[0].id, wallet_id: null })
    // Đã có asset ngân hàng → giữ nguyên, chỉ bỏ wallet_id.
    expect(database.query("SELECT asset_id, wallet_id FROM transactions WHERE id = 'transaction'").get()).toEqual({ asset_id: 'asset', wallet_id: null })
    expect(database.query('SELECT COUNT(*) AS n FROM wallets').get()).toEqual({ n: 0 })
    expect(database.query("SELECT name FROM sqlite_master WHERE name = '_wallet_asset_map'").get()).toBeNull()
    database.close()
  }))

  test('reuses an existing cash asset instead of creating a duplicate', () => withTemporaryDatabase(path => {
    legacyDatabase(path)
    const setup = new Database(path)
    setup.run("INSERT INTO assets (id,user_id,name,type,current_value) VALUES ('my-cash','profile','Ví tiền mặt','cash',5000)")
    setup.run("INSERT INTO transactions (id,user_id,type,amount,category_id,wallet_id,date) VALUES ('cash-only','profile','expense',500,'category','wallet','2026-10-26')")
    setup.close()
    runMigrations(path)
    const database = new Database(path)
    expect(database.query("SELECT COUNT(*) AS n FROM assets WHERE type = 'cash'").get()).toEqual({ n: 1 })
    expect(database.query("SELECT asset_id FROM transactions WHERE id = 'cash-only'").get()).toEqual({ asset_id: 'my-cash' })
    database.close()
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
