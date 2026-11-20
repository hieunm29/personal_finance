import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHILD_FLAG = 'PF_TRANSACTION_IT_CHILD'

type JsonRecord = Record<string, any>

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  assert.deepEqual(actual, expected, message)
}

function assertStatus(response: Response, status: number): void {
  assert.equal(response.status, status, `expected HTTP ${status}, got ${response.status}`)
}

async function requestJson(
  app: { request: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response> },
  user: string,
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: JsonRecord }> {
  const response = await app.request(path, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-test-user': user, ...(init.headers ?? {}) },
  })
  const body = (await response.json()) as JsonRecord
  return { response, body }
}

async function seedAndExerciseDatabase(): Promise<void> {
  const { Hono } = await import('hono')
  const { errorHandler } = await import('../middleware/errorHandler')
  const transactionsRoute = (await import('../routes/transactions')).default
  const { sqlite } = await import('../db/index')

  applyMigrations(sqlite)

  const ids = seedDatabase(sqlite)
  let currentUser = ids.userAAuth
  const app = new Hono<{ Variables: { userId: string } }>()
  app.onError(errorHandler)
  app.use('*', async (context, next) => {
    currentUser = context.req.header('x-test-user') ?? ids.userAAuth
    context.set('userId', currentUser)
    await next()
  })
  app.route('/api/transactions', transactionsRoute)

  const create = async (user: string, data: JsonRecord) => requestJson(app, user, '/api/transactions', { method: 'POST', body: JSON.stringify(data) })
  const update = async (user: string, id: string, data: JsonRecord) => requestJson(app, user, `/api/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) })

  // Bank-asset transactions update the asset balance transactionally across create, edit,
  // account changes, and delete. This also covers the asset wallet-id prefix contract.
  const first = await create(ids.userAAuth, {
    type: 'expense', amount: 250_000, categoryId: ids.foodA, walletId: `asset-${ids.bankA}`,
    date: '2026-10-24', note: 'Bữa tối "đặc biệt"', isRecurring: false,
  })
  assertStatus(first.response, 201)
  const firstId = first.body.data.id as string
  assertEqual(first.body.data.assetId, ids.bankA)
  assertEqual(readValue(sqlite, 'assets', ids.bankA, 'current_value'), 750_000)

  const moved = await update(ids.userAAuth, firstId, {
    amount: 300_000, categoryId: ids.foodA, walletId: `asset-${ids.bankB}`, date: '2026-10-24', note: 'Đổi tài khoản', isRecurring: false,
  })
  assertStatus(moved.response, 200)
  assertEqual(moved.body.data.assetId, ids.bankB)
  assertEqual(readValue(sqlite, 'assets', ids.bankA, 'current_value'), 1_000_000)
  assertEqual(readValue(sqlite, 'assets', ids.bankB, 'current_value'), 1_700_000)

  const movedToWallet = await update(ids.userAAuth, firstId, {
    amount: 200_000, categoryId: ids.foodA, walletId: ids.cashA, date: '2026-10-24', note: 'Ví tiền mặt', isRecurring: false,
  })
  assertStatus(movedToWallet.response, 200)
  assertEqual(movedToWallet.body.data.walletId, ids.cashA)
  assertEqual(movedToWallet.body.data.assetId, null)
  assertEqual(readValue(sqlite, 'assets', ids.bankB, 'current_value'), 2_000_000)

  const deleted = await app.request(`/api/transactions/${firstId}`, { method: 'DELETE', headers: { 'x-test-user': ids.userAAuth } })
  assertStatus(deleted, 204)

  const assetDelete = await create(ids.userAAuth, {
    type: 'expense', amount: 100_000, categoryId: ids.foodA, walletId: `asset-${ids.bankA}`,
    date: '2026-10-24', note: 'Xoá để hoàn số dư', isRecurring: false,
  })
  assertStatus(assetDelete.response, 201)
  assertEqual(readValue(sqlite, 'assets', ids.bankA, 'current_value'), 900_000)
  const assetDeleteResponse = await app.request(`/api/transactions/${assetDelete.body.data.id}`, { method: 'DELETE', headers: { 'x-test-user': ids.userAAuth } })
  assertStatus(assetDeleteResponse, 204)
  assertEqual(readValue(sqlite, 'assets', ids.bankA, 'current_value'), 1_000_000)

  // Ownership checks must reject cross-profile categories, wallets, assets, and transaction ids.
  const foreignCategory = await create(ids.userAAuth, {
    type: 'expense', amount: 1_000, categoryId: ids.foodB, walletId: ids.cashA, date: '2026-10-01', note: 'foreign category', isRecurring: false,
  })
  assertStatus(foreignCategory.response, 404)
  const foreignWallet = await create(ids.userAAuth, {
    type: 'expense', amount: 1_000, categoryId: ids.foodA, walletId: ids.cashB, date: '2026-10-01', note: 'foreign wallet', isRecurring: false,
  })
  assertStatus(foreignWallet.response, 404)
  const foreignAsset = await create(ids.userAAuth, {
    type: 'expense', amount: 1_000, categoryId: ids.foodA, walletId: `asset-${ids.bankOther}`, date: '2026-10-01', note: 'foreign asset', isRecurring: false,
  })
  assertStatus(foreignAsset.response, 404)

  const transactions = [
    { type: 'income', amount: 100_000, categoryId: ids.salaryA, walletId: ids.cashA, date: '2026-10-01', note: 'Lương tháng', isRecurring: false },
    { type: 'expense', amount: 200_000, categoryId: ids.foodA, walletId: ids.cashA, date: '2026-10-02', note: 'Bữa sáng "đặc biệt"', isRecurring: false },
    { type: 'expense', amount: 300_000, categoryId: ids.travelA, walletId: `asset-${ids.bankA}`, date: '2026-10-03', note: '=SUM(A1:A2)', isRecurring: false },
    { type: 'income', amount: 400_000, categoryId: ids.salaryA, walletId: `asset-${ids.bankA}`, date: '2026-10-04', note: 'Thưởng 日本語', isRecurring: false },
    { type: 'expense', amount: 50_000, categoryId: ids.foodA, walletId: ids.cashA, date: '2026-10-05', note: 'Café', isRecurring: false },
  ]
  const createdIds: string[] = []
  for (const data of transactions) {
    const result = await create(ids.userAAuth, data)
    assertStatus(result.response, 201)
    createdIds.push(result.body.data.id)
  }

  const pageOne = await requestJson(app, ids.userAAuth, '/api/transactions?dateFrom=2026-10-01&dateTo=2026-10-31&page=1&limit=2')
  assertStatus(pageOne.response, 200)
  assertEqual(pageOne.body.meta.total, 5)
  assertEqual(pageOne.body.meta.totalPages, 3)
  assertEqual(pageOne.body.data.length, 2)
  assertEqual(pageOne.body.meta.totalIncome, 500_000)
  assertEqual(pageOne.body.meta.totalExpense, 550_000)
  const pageThree = await requestJson(app, ids.userAAuth, '/api/transactions?dateFrom=2026-10-01&dateTo=2026-10-31&page=3&limit=2')
  assertStatus(pageThree.response, 200)
  assertEqual(pageThree.body.meta.total, 5)
  assertEqual(pageThree.body.data.length, 1)

  const filtered = await requestJson(app, ids.userAAuth, `/api/transactions?type=expense&categoryId=${ids.foodA}&amountFrom=100000&amountTo=250000&dateFrom=2026-10-01&dateTo=2026-10-31&limit=100`)
  assertStatus(filtered.response, 200)
  assertEqual(filtered.body.meta.total, 1)
  assertEqual(filtered.body.data[0].amount, 200_000)

  const analytics = await requestJson(app, ids.userAAuth, '/api/transactions/analytics?dateFrom=2026-10-01&dateTo=2026-10-31')
  assertStatus(analytics.response, 200)
  assertEqual(analytics.body.data.total, 5)
  assertEqual(analytics.body.data.totalIncome, 500_000)
  assertEqual(analytics.body.data.totalExpense, 550_000)
  assertEqual(analytics.body.data.incomeCount, 2)
  assertEqual(analytics.body.data.expenseCount, 3)
  assertEqual(analytics.body.data.dailyExpenses.length, 3)

  const cashAndBank = await requestJson(app, ids.userAAuth, `/api/transactions?walletIds=${ids.cashA},asset-${ids.bankA}&dateFrom=2026-10-01&dateTo=2026-10-31&limit=100`)
  assertStatus(cashAndBank.response, 200)
  assertEqual(cashAndBank.body.meta.total, 5)
  const bankOnly = await requestJson(app, ids.userAAuth, `/api/transactions?walletIds=asset-${ids.bankA}&dateFrom=2026-10-01&dateTo=2026-10-31&limit=100`)
  assertStatus(bankOnly.response, 200)
  assertEqual(bankOnly.body.meta.total, 2)

  const unicodeSearch = await requestJson(app, ids.userAAuth, '/api/transactions?search=Café&limit=100')
  assertStatus(unicodeSearch.response, 200)
  assertEqual(unicodeSearch.body.meta.total, 1)
  const japaneseSearch = await requestJson(app, ids.userAAuth, '/api/transactions?search=日本語&limit=100')
  assertStatus(japaneseSearch.response, 200)
  assertEqual(japaneseSearch.body.meta.total, 1)
  const categorySearch = await requestJson(app, ids.userAAuth, '/api/transactions?search=Ăn%20u%E1%BB%91ng&limit=100')
  assertStatus(categorySearch.response, 200)
  assertEqual(categorySearch.body.meta.total, 2)
  const formattedAmountSearch = await requestJson(app, ids.userAAuth, '/api/transactions?search=2.000&limit=100')
  assertStatus(formattedAmountSearch.response, 200)
  assertEqual(formattedAmountSearch.body.meta.total, 1)

  const otherUserGet = await app.request(`/api/transactions/${createdIds[0]}`, { headers: { 'x-test-user': ids.userBAuth } })
  assertStatus(otherUserGet, 404)
  const otherUserUpdate = await update(ids.userBAuth, createdIds[0], { amount: 999_999 })
  assertStatus(otherUserUpdate.response, 404)
  const otherUserDelete = await app.request(`/api/transactions/${createdIds[0]}`, { method: 'DELETE', headers: { 'x-test-user': ids.userBAuth } })
  assertStatus(otherUserDelete, 404)

  const csvResponse = await app.request('/api/transactions/export?dateFrom=2026-10-01&dateTo=2026-10-31', { headers: { 'x-test-user': ids.userAAuth } })
  assertStatus(csvResponse, 200)
  const csv = await csvResponse.text()
  assert(csv.includes(`'${'=SUM(A1:A2)'}`), 'CSV should prefix formula-like notes with an apostrophe')
  assert(csv.includes('"Bữa sáng ""đặc biệt"""'), 'CSV should escape embedded quotes')
  assert(csv.includes('Thưởng 日本語'), 'CSV should preserve Unicode')

  const otherRows = await requestJson(app, ids.userBAuth, '/api/transactions?limit=100')
  assertStatus(otherRows.response, 200)
  assertEqual(otherRows.body.meta.total, 0)

  // Keep the child output machine-readable so a failing isolated process still reports context.
  console.log(JSON.stringify({ ok: true, created: createdIds.length }))
  sqlite.close()
}

function applyMigrations(sqlite: any): void {
  const migrationDirectory = fileURLToPath(new URL('../db/migrations/', import.meta.url))
  for (const file of readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(migrationDirectory, file), 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()
      if (trimmed) sqlite.run(trimmed)
    }
  }
}

function seedDatabase(sqlite: any) {
  const ids = {
    userA: '10000000-0000-4000-8000-000000000001', userB: '10000000-0000-4000-8000-000000000002',
    userAAuth: '20000000-0000-4000-8000-000000000001', userBAuth: '20000000-0000-4000-8000-000000000002',
    groupAExpense: '30000000-0000-4000-8000-000000000001', groupAIncome: '30000000-0000-4000-8000-000000000002', groupBExpense: '30000000-0000-4000-8000-000000000003',
    foodA: '40000000-0000-4000-8000-000000000001', travelA: '40000000-0000-4000-8000-000000000002', salaryA: '40000000-0000-4000-8000-000000000003', foodB: '40000000-0000-4000-8000-000000000004',
    cashA: '50000000-0000-4000-8000-000000000001', cashB: '50000000-0000-4000-8000-000000000002', bankA: '60000000-0000-4000-8000-000000000001', bankB: '60000000-0000-4000-8000-000000000002', bankOther: '60000000-0000-4000-8000-000000000003',
  }
  const run = (sql: string, ...params: unknown[]) => sqlite.run(sql, ...params)
  run(`INSERT INTO user_profiles (id, auth_user_id, display_name, currency, theme) VALUES (?, ?, ?, 'VND', 'system'), (?, ?, ?, 'VND', 'system')`, ids.userA, ids.userAAuth, 'Người dùng A', ids.userB, ids.userBAuth, 'Người dùng B')
  run(`INSERT INTO category_groups (id, user_id, name, type, color, sort_order, is_default) VALUES (?, ?, 'Chi tiêu A', 'expense', '#ef4444', 1, 1), (?, ?, 'Thu nhập A', 'income', '#16a34a', 1, 1), (?, ?, 'Chi tiêu B', 'expense', '#ef4444', 1, 1)`, ids.groupAExpense, ids.userA, ids.groupAIncome, ids.userA, ids.groupBExpense, ids.userB)
  run(`INSERT INTO categories (id, user_id, group_id, name, type, icon, color, sort_order, is_default) VALUES (?, ?, ?, 'Ăn uống', 'expense', 'utensils', '#ef4444', 1, 1), (?, ?, ?, 'Di chuyển', 'expense', 'car', '#f97316', 2, 1), (?, ?, ?, 'Lương', 'income', 'briefcase', '#16a34a', 1, 1), (?, ?, ?, 'Bí mật', 'expense', 'shield', '#06b6d4', 1, 1)`, ids.foodA, ids.userA, ids.groupAExpense, ids.travelA, ids.userA, ids.groupAExpense, ids.salaryA, ids.userA, ids.groupAIncome, ids.foodB, ids.userB, ids.groupBExpense)
  run(`INSERT INTO wallets (id, user_id, name, type, initial_balance, is_default) VALUES (?, ?, 'Tiền mặt A', 'cash', 1000000, 1), (?, ?, 'Tiền mặt B', 'cash', 1000000, 1)`, ids.cashA, ids.userA, ids.cashB, ids.userB)
  run(`INSERT INTO assets (id, user_id, type, name, current_value) VALUES (?, ?, 'bank', 'Ngân hàng A', 1000000), (?, ?, 'bank', 'Ngân hàng B', 2000000), (?, ?, 'bank', 'Ngân hàng khác', 500000)`, ids.bankA, ids.userA, ids.bankB, ids.userA, ids.bankOther, ids.userB)
  return ids
}

function readValue(sqlite: any, table: string, id: string, field: string): number {
  const row = sqlite.query(`SELECT ${field} FROM ${table} WHERE id = ?`).get(id) as Record<string, number>
  return row[field]
}

async function runIsolatedTest(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-transaction-it-'))
  const dbPath = join(directory, 'transaction-test.db')
  const filePath = fileURLToPath(import.meta.url)
  const child = Bun.spawn(['bun', 'run', filePath], {
    cwd: dirname(dirname(dirname(filePath))),
    env: { ...process.env, DATABASE_URL: `file:${dbPath}`, NODE_ENV: 'test', DISABLE_RECURRING_JOB: '1', [CHILD_FLAG]: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  try {
    assert.equal(exitCode, 0, `isolated transaction process failed\nstdout:\n${stdout}\nstderr:\n${stderr}`)
    assert(stdout.includes('"ok":true'), `isolated process did not report success\nstdout:\n${stdout}\nstderr:\n${stderr}`)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

if (process.env[CHILD_FLAG] === '1') {
  await seedAndExerciseDatabase()
} else {
  const { describe, test } = await import('bun:test')
  describe('transaction routes in an isolated SQLite process', () => {
    test('preserve ownership, balances, analytics, pagination, and CSV safety', runIsolatedTest)
  })
}
