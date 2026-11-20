import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHILD = 'PF_CATEGORY_IT_CHILD'

function applyMigrations(sqlite: any) {
  const directory = fileURLToPath(new URL('../db/migrations/', import.meta.url))
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(directory, file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) sqlite.run(statement)
    }
  }
}

async function runChild() {
  const { Hono } = await import('hono')
  const { errorHandler } = await import('../middleware/errorHandler')
  const route = (await import('../routes/categories')).default
  const groupsRoute = (await import('../routes/category-groups')).default
  const { sqlite } = await import('../db')
  applyMigrations(sqlite)

  const ids = {
    profile: '10000000-0000-4000-8000-000000000001', auth: '20000000-0000-4000-8000-000000000001',
    expenseGroup: '30000000-0000-4000-8000-000000000001', incomeGroup: '30000000-0000-4000-8000-000000000002', customGroup: '30000000-0000-4000-8000-000000000003',
    expense: '40000000-0000-4000-8000-000000000001', income: '40000000-0000-4000-8000-000000000002',
  }
  const insert = (sql: string, ...args: any[]) => sqlite.run(sql, ...args)
  insert(`INSERT INTO user_profiles (id, auth_user_id, display_name, currency, theme) VALUES (?, ?, 'Test', 'VND', 'system')`, ids.profile, ids.auth)
  insert(`INSERT INTO category_groups (id,user_id,name,type,color,sort_order,is_default) VALUES (?,?, 'Chi tiêu','expense','#ef4444',1,1),(?,?, 'Thu nhập','income','#16a34a',2,1),(?,?, 'Tùy chỉnh','expense','#3b82f6',3,0)`, ids.expenseGroup, ids.profile, ids.incomeGroup, ids.profile, ids.customGroup, ids.profile)
  insert(`INSERT INTO categories (id,user_id,group_id,name,type,icon,color,sort_order,is_default) VALUES (?,?,?,?,?,?,?,1,1),(?,?,?,?,?,?,?,1,1)`, ids.expense, ids.profile, ids.expenseGroup, 'Ăn uống', 'expense', 'utensils', '#ef4444', ids.income, ids.profile, ids.incomeGroup, 'Lương', 'income', 'briefcase', '#16a34a')
  insert(`INSERT INTO transactions (id,user_id,type,amount,category_id,date,is_recurring) VALUES ('50000000-0000-4000-8000-000000000001',?,'expense',100000,?,'2026-10-01',0)`, ids.profile, ids.expense)

  const app = new Hono<{ Variables: { userId: string } }>()
  app.onError(errorHandler)
  app.use('*', async (c, next) => { c.set('userId', ids.auth); await next() })
  app.route('/api/categories', route)
  app.route('/api/category-groups', groupsRoute)
  const json = async (path: string, init: RequestInit = {}) => {
    const response = await app.request(path, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } })
    return { response, body: await response.json().catch(() => null) as any }
  }

  const list = await json('/api/categories?showHidden=true')
  assert.equal(list.response.status, 200)
  assert.equal(list.body.data[0].type, 'expense')
  const usage = await json(`/api/categories/${ids.expense}/usage`)
  assert.equal(usage.body.data.transactionCount, 1)
  const mismatch = await json('/api/categories', { method: 'POST', body: JSON.stringify({ groupId: ids.expenseGroup, type: 'income', name: 'Sai loại' }) })
  assert.equal(mismatch.response.status, 400)
  const groupConflict = await app.request(`/api/category-groups/${ids.expenseGroup}`, { method: 'DELETE' })
  assert.equal(groupConflict.status, 400)
  const emptyGroup = await app.request(`/api/category-groups/${ids.customGroup}`, { method: 'DELETE' })
  assert.equal(emptyGroup.status, 204)
  const order = await json('/api/categories/order', { method: 'PATCH', body: JSON.stringify({ items: [{ id: ids.expense, sortOrder: 7 }] }) })
  assert.equal(order.response.status, 204)
  console.log(JSON.stringify({ ok: true }))
  sqlite.close()
}

async function runIsolated() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-category-it-'))
  const dbPath = join(directory, 'category-test.db')
  const filePath = fileURLToPath(import.meta.url)
  const child = Bun.spawn(['bun', 'run', filePath], { cwd: dirname(dirname(dirname(filePath))), env: { ...process.env, DATABASE_URL: `file:${dbPath}`, NODE_ENV: 'test', [CHILD]: '1' }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  try { assert.equal(exitCode, 0, `category API child failed\n${stdout}\n${stderr}`); assert(stdout.includes('"ok":true')) } finally { rmSync(directory, { recursive: true, force: true }) }
}

if (process.env[CHILD] === '1') await runChild()
else {
  const { describe, test } = await import('bun:test')
  describe('category APIs', () => { test('validate ownership, usage and ordering operations', runIsolated) })
}
