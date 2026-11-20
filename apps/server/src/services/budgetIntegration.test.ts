import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHILD = 'PF_BUDGET_IT_CHILD'

function applyMigrations(sqlite: any) {
  const directory = fileURLToPath(new URL('../db/migrations/', import.meta.url))
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(directory, file), 'utf8').split('--> statement-breakpoint')) if (statement.trim()) sqlite.run(statement)
  }
}

async function runChild() {
  const { Hono } = await import('hono')
  const { errorHandler } = await import('../middleware/errorHandler')
  const route = (await import('../routes/budget')).default
  const { sqlite } = await import('../db')
  applyMigrations(sqlite)
  const auth = '20000000-0000-4000-8000-000000000001'
  const profile = '10000000-0000-4000-8000-000000000001'
  const group = '30000000-0000-4000-8000-000000000001'
  const food = '40000000-0000-4000-8000-000000000001'
  const unbudgeted = '40000000-0000-4000-8000-000000000002'
  const budget = '50000000-0000-4000-8000-000000000001'
  const run = (sql: string, ...args: any[]) => sqlite.run(sql, ...args)
  run(`INSERT INTO user_profiles (id,auth_user_id,display_name,currency,theme) VALUES (?,?,'Test','VND','system')`, profile, auth)
  run(`INSERT INTO category_groups (id,user_id,name,type,color,sort_order,is_default) VALUES (?,?, 'Thiết yếu','expense','#ef4444',1,1)`, group, profile)
  run(`INSERT INTO categories (id,user_id,group_id,name,type,icon,color,sort_order,is_default) VALUES (?,?,?,?,?,?,?,1,1),(?,?,?,?,?,?,?,2,1)`, food, profile, group, 'Ăn uống', 'expense', 'utensils', '#ef4444', unbudgeted, profile, group, 'Nhà ở', 'expense', 'house', '#eab308')
  run(`INSERT INTO budgets (id,user_id,month,total_limit) VALUES (?,?, '2026-10', 1500000)`, budget, profile)
  run(`INSERT INTO category_budgets (id,budget_id,category_id,limit_amount) VALUES ('60000000-0000-4000-8000-000000000001',?,?,1000000)`, budget, food)
  run(`INSERT INTO transactions (id,user_id,type,amount,category_id,date,is_recurring) VALUES ('70000000-0000-4000-8000-000000000001',?,'expense',800000,?,'2026-10-05',0)`, profile, food)
  const app = new Hono<{ Variables: { userId: string } }>()
  app.onError(errorHandler)
  app.use('*', async (c, next) => { c.set('userId', auth); await next() })
  app.route('/api/budgets', route)
  const response = await app.request('/api/budgets/overview?month=2026-10')
  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.equal(body.data.totalSpent, 800000)
  assert.equal(body.data.remaining, 700000)
  assert.equal(body.data.allocatedAmount, 1000000)
  assert.equal(body.data.unallocatedAmount, 500000)
  assert.equal(body.data.categories[0].percentage, 80)
  assert.equal(body.data.unbudgetedCategories[0].name, 'Nhà ở')
  assert.equal(body.data.history.length, 1)
  const suggestion = await app.request('/api/budgets/suggestion?month=2026-11')
  assert.equal(suggestion.status, 200)
  const suggestionBody = await suggestion.json() as any
  assert.equal(suggestionBody.data.basedOnMonths, 3)
  assert.equal(suggestionBody.data.categories[0].categoryId, food)
  console.log(JSON.stringify({ ok: true }))
  sqlite.close()
}

async function runIsolated() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-budget-it-'))
  const dbPath = join(directory, 'budget-test.db')
  const filePath = fileURLToPath(import.meta.url)
  const child = Bun.spawn(['bun', 'run', filePath], { cwd: dirname(dirname(dirname(filePath))), env: { ...process.env, DATABASE_URL: `file:${dbPath}`, NODE_ENV: 'test', [CHILD]: '1' }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  try { assert.equal(exitCode, 0, `budget API child failed\n${stdout}\n${stderr}`); assert(stdout.includes('"ok":true')) } finally { rmSync(directory, { recursive: true, force: true }) }
}

if (process.env[CHILD] === '1') await runChild()
else {
  const { describe, test } = await import('bun:test')
  describe('budget overview API', () => { test('returns scoped totals, allocation and unbudgeted categories', runIsolated) })
}
