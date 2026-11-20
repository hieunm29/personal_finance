import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHILD = 'PF_ASSET_IT_CHILD'

function applyMigrations(sqlite: any) {
  const directory = fileURLToPath(new URL('../db/migrations/', import.meta.url))
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(directory, file), 'utf8').split('--> statement-breakpoint')) if (statement.trim()) sqlite.run(statement)
  }
}

async function runChild() {
  const { Hono } = await import('hono')
  const { errorHandler } = await import('../middleware/errorHandler')
  const route = (await import('../routes/assets')).default
  const { sqlite } = await import('../db')
  applyMigrations(sqlite)
  const auth = '20000000-0000-4000-8000-000000000001'
  const profile = '10000000-0000-4000-8000-000000000001'
  const gold = '40000000-0000-4000-8000-000000000001'
  const stock = '40000000-0000-4000-8000-000000000002'
  const run = (sql: string, ...args: any[]) => sqlite.run(sql, ...args)
  run(`INSERT INTO user_profiles (id,auth_user_id,display_name,currency,theme,gold_price_per_luong) VALUES (?,?,'Test','VND','system',14000000000)`, profile, auth)
  run(`INSERT INTO assets (id,user_id,type,name,current_value,metadata) VALUES (?,?, 'gold','Nhẫn',14000000000,?), (?,?, 'stock','DCM',7700000000,?)`, gold, profile, JSON.stringify({ unit: 'luong', quantity: 1, purchaseAmount: 11800000000 }), stock, profile, JSON.stringify({ ticker: 'DCM', quantity: 2000, avgBuyPrice: 3200000 }))
  run(`INSERT INTO asset_history (id,asset_id,date,value) VALUES ('50000000-0000-4000-8000-000000000001',?,'2026-09-30',48000000000)`, gold)
  const app = new Hono<{ Variables: { userId: string } }>()
  app.onError(errorHandler)
  app.use('*', async (c, next) => { c.set('userId', auth); await next() })
  app.route('/api/assets', route)
  const response = await app.request('/api/assets/overview')
  assert.equal(response.status, 200)
  const body = await response.json() as any
  assert.equal(body.data.totalAssets, 21700000000)
  assert.equal(body.data.groups.find((group: any) => group.type === 'gold').items[0].pnl, 2200000000)
  assert.equal(body.data.groups.find((group: any) => group.type === 'stock').items[0].pnl, 1300000000)
  const revalue = await app.request('/api/assets/revalue', { method: 'POST' })
  assert.equal(revalue.status, 200)
  const revalueBody = await revalue.json() as any
  assert.equal(revalueBody.data.groups.find((group: any) => group.type === 'gold').items[0].currentValue, 14000000000)
  console.log(JSON.stringify({ ok: true }))
  sqlite.close()
}

async function runIsolated() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-asset-it-'))
  const dbPath = join(directory, 'asset-test.db')
  const filePath = fileURLToPath(import.meta.url)
  const child = Bun.spawn(['bun', 'run', filePath], { cwd: dirname(dirname(dirname(filePath))), env: { ...process.env, DATABASE_URL: `file:${dbPath}`, NODE_ENV: 'test', [CHILD]: '1' }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  try { assert.equal(exitCode, 0, `asset API child failed\n${stdout}\n${stderr}`); assert(stdout.includes('"ok":true')) } finally { rmSync(directory, { recursive: true, force: true }) }
}

if (process.env[CHILD] === '1') await runChild()
else {
  const { describe, test } = await import('bun:test')
  describe('asset overview API', () => { test('returns grouped summaries and revalues gold holdings', runIsolated) })
}
