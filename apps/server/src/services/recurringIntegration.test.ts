import { describe, expect, test } from 'bun:test'
import { strict as assert } from 'node:assert'
import { Database } from 'bun:sqlite'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CHILD_FLAG = 'PF_RECURRING_INTEGRATION_CHILD'

function applyMigrations(sqlite: Database) {
  const directory = join(import.meta.dir, '../db/migrations')
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(directory, file), 'utf8').split(/--> statement-breakpoint/).map((part) => part.trim()).filter(Boolean)) {
      sqlite.run(statement)
    }
  }
}

async function runChild() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-recurring-'))
  const databasePath = join(directory, 'test.db')
  const sqlite = new Database(databasePath)
  applyMigrations(sqlite)
  const profile = 'profile-recurring-test'
  const group = 'group-recurring-test'
  const category = 'category-recurring-test'
  const asset = 'asset-recurring-test'
  sqlite.run('INSERT INTO user_profiles (id, auth_user_id, display_name, currency, theme) VALUES (?, ?, ?, ?, ?)', [profile, 'auth-recurring-test', 'Test', 'VND', 'system'])
  sqlite.run('INSERT INTO category_groups (id, user_id, name, type) VALUES (?, ?, ?, ?)', [group, profile, 'Chi tiêu', 'expense'])
  sqlite.run('INSERT INTO categories (id, user_id, group_id, name, type) VALUES (?, ?, ?, ?, ?)', [category, profile, group, 'Nhà ở', 'expense'])
  sqlite.run('INSERT INTO assets (id, user_id, type, name, current_value) VALUES (?, ?, ?, ?, ?)', [asset, profile, 'bank', 'Ngân hàng', 1_000_000])
  sqlite.close()

  process.env.DATABASE_URL = `file:${databasePath}`
  process.env.DISABLE_RECURRING_JOB = '1'
  const transactions = await import('./transactionService')
  const recurring = await import('./recurringService')
  const db = (await import('../db')).sqlite

  const original = transactions.createTransaction('auth-recurring-test', {
    type: 'expense', amount: 100_000, categoryId: category, walletId: `asset-${asset}`,
    date: '2026-01-31', note: 'Rent', isRecurring: true, recurrenceInterval: 'monthly',
  })
  assert.equal(original.recurringTemplateId !== null, true)
  assert.equal(original.recurrenceInterval, 'monthly')
  assert.equal((db.query('SELECT current_value AS value FROM assets WHERE id = ?').get(asset) as { value: number }).value, 900_000)

  const generated = recurring.generateDueTransactions('auth-recurring-test', '2026-03-31')
  assert.equal(generated.created, 2)
  assert.deepEqual(db.query('SELECT date FROM transactions WHERE recurring_template_id = ? ORDER BY date').all(original.recurringTemplateId), [
    { date: '2026-01-31' }, { date: '2026-02-28' }, { date: '2026-03-31' },
  ])
  assert.equal(recurring.generateDueTransactions('auth-recurring-test', '2026-03-31').created, 0)
  assert.equal((db.query('SELECT current_value AS value FROM assets WHERE id = ?').get(asset) as { value: number }).value, 700_000)

  const edited = transactions.updateTransaction('auth-recurring-test', original.id, { isRecurring: false })
  assert.equal(edited.isRecurring, false)
  assert.equal((db.query('SELECT is_active AS active FROM recurring_templates WHERE id = ?').get(original.recurringTemplateId) as { active: number }).active, 0)
  assert.equal(recurring.generateDueTransactions('auth-recurring-test', '2026-04-30').created, 0)

  const deletedSchedule = transactions.createTransaction('auth-recurring-test', {
    type: 'expense', amount: 25_000, categoryId: category, walletId: `asset-${asset}`,
    date: '2026-02-28', note: 'Delete me', isRecurring: true, recurrenceInterval: 'monthly',
  })
  const deletedTemplate = deletedSchedule.recurringTemplateId!
  transactions.deleteTransaction('auth-recurring-test', deletedSchedule.id)
  assert.equal((db.query('SELECT is_active AS active FROM recurring_templates WHERE id = ?').get(deletedTemplate) as { active: number }).active, 0)

  const catchup = recurring.createRecurring('auth-recurring-test', {
    type: 'expense', amount: 10_000, categoryId: category, walletId: `asset-${asset}`,
    note: 'Catch-up', interval: 'monthly', startDate: '2026-01-31', endDate: '2026-03-31',
  })
  assert.equal(recurring.generateDueTransactions('auth-recurring-test', '2026-04-30').created, 3)
  assert.equal((db.query('SELECT is_active AS active FROM recurring_templates WHERE id = ?').get(catchup.id) as { active: number }).active, 0)

  const editable = recurring.createRecurring('auth-recurring-test', {
    type: 'expense', amount: 5_000, categoryId: category, walletId: `asset-${asset}`,
    note: 'Editable', interval: 'weekly', startDate: '2027-01-01',
  })
  const changed = recurring.updateRecurring('auth-recurring-test', editable.id, {
    amount: 7_500, recurrenceInterval: 'monthly', isActive: false,
  })
  assert.equal(changed.amount, 7_500)
  assert.equal(changed.interval, 'monthly')
  assert.equal(changed.isActive, false)
  recurring.deleteRecurring('auth-recurring-test', editable.id)
  assert.equal(db.query('SELECT id FROM recurring_templates WHERE id = ?').get(editable.id), null)
  db.close()
  rmSync(directory, { recursive: true, force: true })
}

if (process.env[CHILD_FLAG] === '1') {
  await runChild()
} else {
  describe('recurring transactions in isolated SQLite', () => {
    test('links, edits, disables, deletes, catches up, and clamps calendar dates', () => {
      const result = Bun.spawnSync({
        cmd: ['bun', 'run', import.meta.path],
        env: { ...process.env, [CHILD_FLAG]: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      expect(result.exitCode).toBe(0)
      if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr))
    })
  })
}
