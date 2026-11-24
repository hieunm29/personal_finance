import { describe, expect, test } from 'bun:test'
import { strict as assert } from 'node:assert'
import { Database } from 'bun:sqlite'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CHILD_FLAG = 'PF_SAFE_TO_SPEND_CHILD'
const AUTH = 'auth-safe-test'
const PROFILE = 'profile-safe-test'
const CATEGORY = 'category-safe-test'

function applyMigrations(sqlite: Database) {
  const directory = join(import.meta.dir, '../db/migrations')
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(directory, file), 'utf8').split(/--> statement-breakpoint/).map((part) => part.trim()).filter(Boolean)) {
      sqlite.run(statement)
    }
  }
}

async function runChild() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-safe-'))
  const databasePath = join(directory, 'test.db')
  const sqlite = new Database(databasePath)
  applyMigrations(sqlite)
  sqlite.run('INSERT INTO user_profiles (id, auth_user_id, display_name, currency, theme) VALUES (?, ?, ?, ?, ?)', [PROFILE, AUTH, 'Test', 'VND', 'system'])
  sqlite.run('INSERT INTO category_groups (id, user_id, name, type) VALUES (?, ?, ?, ?)', ['group-safe', PROFILE, 'Chi tiêu', 'expense'])
  sqlite.run('INSERT INTO categories (id, user_id, group_id, name, type) VALUES (?, ?, ?, ?, ?)', [CATEGORY, PROFILE, 'group-safe', 'Nhà ở', 'expense'])
  sqlite.close()

  process.env.DATABASE_URL = `file:${databasePath}`
  process.env.NODE_ENV = 'test'
  const db = (await import('../db')).sqlite
  const recurring = await import('./recurringService')
  const budget = await import('./budgetService')

  const template = (
    id: string, type: 'expense' | 'income', amount: number, interval: string,
    start: string, end: string | null, lastGenerated: string | null, active = 1,
  ) => db.run(
    `INSERT INTO recurring_templates (id, user_id, type, amount, category_id, interval, start_date, end_date, last_generated_date, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, PROFILE, type, amount, CATEGORY, interval, start, end, lastGenerated, active],
  )
  const dates = (from: string, to: string) => recurring.listUpcomingOccurrences(AUTH, from, to).map((o) => `${o.templateId}@${o.date}`)

  // ── listUpcomingOccurrences ────────────────────────────────────────────────
  template('monthly', 'expense', 600_000, 'monthly', '2026-01-25', null, '2026-10-25') // tháng 10 đã sinh
  template('weekly', 'expense', 100_000, 'weekly', '2026-11-07', null, '2026-11-14') // 7, 14 đã sinh
  template('ending', 'expense', 10_000, 'weekly', '2026-11-02', '2026-11-16', null) // có ngày kết thúc
  template('inactive', 'expense', 999, 'monthly', '2026-01-05', null, null, 0)
  template('clamped', 'expense', 50_000, 'monthly', '2026-01-31', null, '2026-10-31') // 31 → 30/11
  template('future', 'expense', 70_000, 'monthly', '2027-01-01', null, null) // chưa bắt đầu

  assert.deepEqual(dates('2026-11-01', '2026-11-30'), [
    'ending@2026-11-02', 'ending@2026-11-09', 'ending@2026-11-16', // dừng ở endDate
    'weekly@2026-11-21', 'weekly@2026-11-28',                       // bỏ 7 và 14 vì đã sinh
    'monthly@2026-11-25',
    'clamped@2026-11-30',                                           // ngày 31 rút về 30
  ].sort((a, b) => a.split('@')[1].localeCompare(b.split('@')[1]) || a.localeCompare(b)))
  assert.equal(dates('2026-11-01', '2026-11-30').some((entry) => entry.startsWith('inactive')), false)
  assert.equal(dates('2026-11-01', '2026-11-30').some((entry) => entry.startsWith('future')), false)
  assert.deepEqual(dates('2026-11-26', '2026-11-29'), ['weekly@2026-11-28']) // lọc theo khoảng ngày
  const sorted = recurring.listUpcomingOccurrences(AUTH, '2026-11-01', '2026-11-30').map((o) => o.date)
  assert.deepEqual(sorted, [...sorted].sort())

  // ── getSafeToSpend ─────────────────────────────────────────────────────────
  db.run('DELETE FROM recurring_templates')
  assert.equal(budget.getSafeToSpend(AUTH, '2026-11-21'), null) // chưa có ngân sách tháng này

  db.run('INSERT INTO budgets (id, user_id, month, total_limit) VALUES (?, ?, ?, ?)', ['budget-nov', PROFILE, '2026-11', 3_000_000])
  db.run(
    'INSERT INTO transactions (id, user_id, type, amount, category_id, date) VALUES (?, ?, ?, ?, ?, ?)',
    ['tx-1', PROFILE, 'expense', 1_000_000, CATEGORY, '2026-11-05'],
  )

  // Không có hóa đơn: còn 2.000.000 chia cho 10 ngày (21 → 30, tính cả hôm nay)
  assert.deepEqual(budget.getSafeToSpend(AUTH, '2026-11-21'), { perDay: 200_000, remaining: 2_000_000, upcomingBills: 0, daysLeft: 10 })

  // Có hóa đơn 600.000 đến hạn 25/11: trừ trước khi chia
  template('rent', 'expense', 600_000, 'monthly', '2026-01-25', null, '2026-10-25')
  assert.deepEqual(budget.getSafeToSpend(AUTH, '2026-11-21'), { perDay: 140_000, remaining: 2_000_000, upcomingBills: 600_000, daysLeft: 10 })

  // Khoản thu định kỳ không được cộng vào
  template('salary', 'income', 5_000_000, 'monthly', '2026-01-28', null, '2026-10-28')
  assert.equal(budget.getSafeToSpend(AUTH, '2026-11-21')!.perDay, 140_000)

  // Hóa đơn đã được sinh thành giao dịch (đã nằm trong "đã chi") thì không bị trừ hai lần
  db.run("UPDATE recurring_templates SET last_generated_date = '2026-11-25' WHERE id = 'rent'")
  assert.equal(budget.getSafeToSpend(AUTH, '2026-11-21')!.upcomingBills, 0)
  db.run("UPDATE recurring_templates SET last_generated_date = '2026-10-25' WHERE id = 'rent'")

  // Ngày cuối tháng: chỉ còn 1 ngày
  assert.deepEqual(budget.getSafeToSpend(AUTH, '2026-11-30'), { perDay: 1_400_000, remaining: 2_000_000, upcomingBills: 600_000, daysLeft: 1 })

  // Hóa đơn lớn hơn số còn lại: 0, không bao giờ âm
  template('big', 'expense', 5_000_000, 'monthly', '2026-01-26', null, '2026-10-26')
  const squeezed = budget.getSafeToSpend(AUTH, '2026-11-21')!
  assert.equal(squeezed.perDay, 0)
  assert.equal(squeezed.remaining, 2_000_000)

  // Vượt ngân sách: tổng chi 1.000.000 + 3.000.000 > hạn mức 3.000.000 → remaining âm, perDay vẫn là 0
  db.run('DELETE FROM recurring_templates')
  db.run(
    'INSERT INTO transactions (id, user_id, type, amount, category_id, date) VALUES (?, ?, ?, ?, ?, ?)',
    ['tx-2', PROFILE, 'expense', 3_000_000, CATEGORY, '2026-11-10'],
  )
  const over = budget.getSafeToSpend(AUTH, '2026-11-21')!
  assert.equal(over.remaining, -1_000_000)
  assert.equal(over.perDay, 0)

  // ── Dashboard + tool của bot: chỉ có số cho tháng hiện tại (theo giờ VN) ──
  const { vnClock } = await import('../lib/vnTime')
  const thisMonth = vnClock().date.slice(0, 7)
  const lastMonth = new Date(Date.UTC(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)) - 2, 1)).toISOString().slice(0, 7)
  db.run('DELETE FROM transactions')
  db.run('INSERT INTO budgets (id, user_id, month, total_limit) VALUES (?, ?, ?, ?)', ['budget-now', PROFILE, thisMonth, 3_000_000])
  db.run('INSERT INTO budgets (id, user_id, month, total_limit) VALUES (?, ?, ?, ?)', ['budget-prev', PROFILE, lastMonth, 3_000_000])

  const { getDashboardData } = await import('./dashboardService')
  const current = getDashboardData(AUTH, thisMonth).safeToSpend
  assert.ok(current && current.daysLeft >= 1 && current.perDay > 0)
  assert.equal(getDashboardData(AUTH, lastMonth).safeToSpend, null)

  const { buildTools } = await import('../ai/tools')
  // buildTools trả về union nhiều tool với input khác nhau; ở đây chỉ gọi một tool nên ép về kiểu chung
  const statusTool = buildTools({ authUserId: AUTH }).find((tool) => tool.name === 'get_budget_status') as unknown as {
    run: (input: Record<string, unknown>) => Promise<string>
  }
  const status = JSON.parse(await statusTool.run({}))
  assert.equal(status.hasBudget, true)
  assert.equal(status.safeToSpendPerDayVnd, Math.round(current.perDay / 100))
  assert.equal(status.daysLeftIncludingToday, current.daysLeft)
  const past = JSON.parse(await statusTool.run({ month: lastMonth }))
  assert.equal(past.safeToSpendPerDayVnd, null)

  db.close()
  rmSync(directory, { recursive: true, force: true })
}

if (process.env[CHILD_FLAG] === '1') {
  await runChild()
} else {
  describe('safe to spend in isolated SQLite', () => {
    test('upcoming recurring occurrences, per-day allowance, dashboard and bot tool', () => {
      const result = Bun.spawnSync({
        cmd: ['bun', 'run', import.meta.path],
        env: { ...process.env, [CHILD_FLAG]: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr))
      expect(result.exitCode).toBe(0)
    })
  })
}
