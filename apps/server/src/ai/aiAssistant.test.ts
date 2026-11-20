import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Kiểm thử trợ lý AI KHÔNG gọi Claude thật:
 *  - tools: gọi thẳng hàm `run` như khi Claude yêu cầu
 *  - webhook: thay runAgent / sendMessage bằng hàm giả để kiểm tra luồng Zalo
 * Chạy trong process con với DB tạm, giống các integration test khác.
 */
const CHILD = 'PF_AI_IT_CHILD'

function applyMigrations(sqlite: any) {
  const directory = fileURLToPath(new URL('../db/migrations/', import.meta.url))
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(directory, file), 'utf8').split('--> statement-breakpoint')) if (statement.trim()) sqlite.run(statement)
  }
}

async function runChild() {
  process.env.ZALO_WEBHOOK_SECRET = 'test-secret'

  // Server giả đóng vai OpenRouter: trả lần lượt các phản hồi đã soạn sẵn.
  const scripted: any[] = []
  const requests: any[] = []
  const mock = Bun.serve({
    port: 0,
    async fetch(request) {
      const body = await request.json()
      requests.push(body)
      const next = scripted.shift()
      assert(next, 'mock model received an unexpected request')
      return Response.json({ id: `msg_${requests.length}`, type: 'message', role: 'assistant', model: body.model, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, ...next })
    },
  })
  process.env.AI_PROVIDER = 'openrouter'
  process.env.OPENROUTER_API_KEY = 'test-key'
  process.env.AI_BASE_URL = `http://localhost:${mock.port}`
  const say = (text: string) => ({ content: [{ type: 'text', text }], stop_reason: 'end_turn' })
  const callTool = (name: string, input: unknown) => ({ content: [{ type: 'tool_use', id: `toolu_${requests.length}`, name, input }], stop_reason: 'tool_use' })
  const { sqlite } = await import('../db')
  applyMigrations(sqlite)
  const { buildTools } = await import('./tools')
  const { loadHistory, saveTurn } = await import('./memory')
  const { createLinkCode } = await import('../channels/zalo/linking')
  const { createZaloWebhook } = await import('../channels/zalo/webhook')

  const authA = '20000000-0000-4000-8000-00000000000a'
  const authB = '20000000-0000-4000-8000-00000000000b'
  const profileA = '10000000-0000-4000-8000-00000000000a'
  const profileB = '10000000-0000-4000-8000-00000000000b'
  const groupA = '30000000-0000-4000-8000-00000000000a'
  const foodA = '40000000-0000-4000-8000-00000000000a'
  const salaryA = '40000000-0000-4000-8000-0000000000a2'
  const walletA = '50000000-0000-4000-8000-00000000000a'
  const run = (sql: string, ...args: any[]) => sqlite.run(sql, ...args)
  run(`INSERT INTO user_profiles (id,auth_user_id,display_name,currency,theme) VALUES (?,?,'A','VND','system'),(?,?,'B','VND','system')`, profileA, authA, profileB, authB)
  run(`INSERT INTO category_groups (id,user_id,name,type,sort_order,is_default) VALUES (?,?,'Chung','expense',1,1)`, groupA, profileA)
  run(`INSERT INTO categories (id,user_id,group_id,name,type,sort_order,is_default) VALUES (?,?,?,'Ăn uống','expense',1,1),(?,?,?,'Lương','income',2,1)`, foodA, profileA, groupA, salaryA, profileA, groupA)
  run(`INSERT INTO wallets (id,user_id,name,type,initial_balance,is_default) VALUES (?,?,'Tiền mặt','cash',0,1)`, walletA, profileA)

  const tool = (authUserId: string, name: string) => {
    const found = buildTools({ authUserId }).find((item) => item.name === name)
    assert(found, `missing tool ${name}`)
    return found as unknown as { run: (input: any) => Promise<string> }
  }

  // ─── create_transaction: VND → cents, ví mặc định, ghi ai_actions ───
  const created = JSON.parse(await tool(authA, 'create_transaction').run({ type: 'expense', amountVnd: 45000, categoryId: foodA, date: '2026-11-10', note: 'Cà phê' }))
  assert.equal(created.ok, true)
  assert.equal(created.amountVnd, 45000)
  assert.equal(created.account, 'Tiền mặt')
  const row = sqlite.query('SELECT amount, wallet_id FROM transactions WHERE id = ?').get(created.transactionId) as any
  assert.equal(row.amount, 4_500_000)
  assert.equal(row.wallet_id, walletA)

  await tool(authA, 'create_transaction').run({ type: 'income', amountVnd: 20_000_000, categoryId: salaryA, date: '2026-11-05' })

  // Sai loại danh mục → lỗi để Claude tự sửa
  await assert.rejects(() => tool(authA, 'create_transaction').run({ type: 'income', amountVnd: 1000, categoryId: foodA }), /không khớp/)
  // User B không dùng được danh mục của A
  await assert.rejects(() => tool(authB, 'create_transaction').run({ type: 'expense', amountVnd: 1000, categoryId: foodA }), /chưa có ví|không tồn tại/)

  // ─── thống kê ───
  const summary = JSON.parse(await tool(authA, 'get_monthly_summary').run({ month: '2026-11' }))
  assert.equal(summary.totalIncomeVnd, 20_000_000)
  assert.equal(summary.totalExpenseVnd, 45000)
  assert.equal(summary.expensesByCategory[0].category, 'Ăn uống')

  const search = JSON.parse(await tool(authA, 'search_transactions').run({ dateFrom: '2026-11-01', dateTo: '2026-11-30', type: 'expense' }))
  assert.equal(search.total, 1)
  assert.equal(search.items[0].note, 'Cà phê')
  const searchB = JSON.parse(await tool(authB, 'search_transactions').run({}))
  assert.equal(searchB.total, 0, 'user B must not see user A transactions')

  const budget = JSON.parse(await tool(authA, 'get_budget_status').run({ month: '2026-11' }))
  assert.equal(budget.hasBudget, false)

  // ─── undo: xóa giao dịch AI ghi gần nhất (lương), rồi đến cà phê ───
  const undo = JSON.parse(await tool(authA, 'undo_last_action').run({}))
  assert.match(undo.undone, /Thu 20\.000\.000đ/)
  await tool(authA, 'undo_last_action').run({})
  assert.equal((sqlite.query('SELECT COUNT(*) AS n FROM transactions').get() as any).n, 0)
  await assert.rejects(() => tool(authA, 'undo_last_action').run({}), /Không có giao dịch/)

  // ─── memory ───
  saveTurn(profileA, 'xin chào', 'Chào bạn!')
  saveTurn(profileA, 'tháng này tiêu bao nhiêu', '45.000đ')
  const history = loadHistory(profileA, 3)
  assert.equal(history[0].role, 'user', 'history must start with a user turn')
  assert.equal(history.at(-1)?.content, '45.000đ')

  // ─── guard chống bịa: tái hiện lỗi "Đã ghi" mà không gọi tool ───
  const { runAgent } = await import('./agent')
  const fakeClaim = 'Đã ghi: thu 28.000.000đ – Lương – ví Tiền mặt.'
  // Lần 1 model bịa; guard bắt làm lại; lần 2 model gọi tool thật rồi xác nhận.
  scripted.push(
    say(fakeClaim),
    callTool('create_transaction', { type: 'income', amountVnd: 28_000_000, categoryId: salaryA, date: '2026-11-20' }),
    say(fakeClaim),
  )
  const recovered = await runAgent({ authUserId: authA, text: 'Lương tháng 11 28 triệu', channel: 'cli' })
  assert.equal(recovered, fakeClaim)
  assert.match(JSON.stringify(requests[1].messages), /\[Hệ thống kiểm tra\]/, 'retry must carry the guard nudge')
  const salaryRow = sqlite.query("SELECT amount FROM transactions WHERE type = 'income'").get() as any
  assert.equal(salaryRow.amount, 2_800_000_000, 'salary must really be written')
  const savedReply = sqlite.query("SELECT content FROM ai_messages WHERE role = 'assistant' ORDER BY rowid DESC").get() as any
  assert.match(savedReply.content, /\[Hệ thống ghi nhận: create_transaction thành công \(id /)

  // Model bịa cả 2 lần → chặn cứng, không ghi gì, báo người dùng.
  scripted.push(say('Đã ghi: chi 30.000đ – Ăn uống.'), say('Đã ghi: chi 30.000đ – Ăn uống.'))
  const blocked = await runAgent({ authUserId: authA, text: 'ăn sáng 30', channel: 'cli' })
  assert.match(blocked, /CHƯA ghi được/)
  assert.equal((sqlite.query("SELECT COUNT(*) AS n FROM transactions WHERE type = 'expense'").get() as any).n, 0)
  assert.equal(scripted.length, 0)
  mock.stop(true)

  // ─── webhook Zalo ───
  const sent: Array<{ chatId: string; text: string }> = []
  const agentCalls: Array<{ authUserId: string; text: string }> = []
  const { route, waitIdle } = createZaloWebhook({
    runAgent: async (input) => { agentCalls.push(input); return 'Đã ghi!' },
    sendMessage: async (chatId, text) => { sent.push({ chatId, text }) },
    sendTyping: async () => {},
  })
  const post = (body: unknown, secret = 'test-secret') => route.request('/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-bot-api-secret-token': secret },
    body: JSON.stringify(body),
  })
  const textUpdate = (id: string, text: string) => ({
    event_name: 'message.text.received',
    message: { message_id: id, text, from: { id: 'zalo-user-1', display_name: 'An', is_bot: false }, chat: { id: 'zalo-user-1', chat_type: 'PRIVATE' } },
  })

  assert.equal((await post(textUpdate('m0', 'hi'), 'wrong')).status, 401)

  assert.equal((await post(textUpdate('m1', 'mua cà phê 45k'))).status, 200)
  await waitIdle()
  assert.match(sent.at(-1)!.text, /chưa liên kết/)
  assert.equal(agentCalls.length, 0, 'unlinked users must not reach the AI')

  const { code } = createLinkCode(authA)
  await post(textUpdate('m2', `/link ${code.toLowerCase()}`))
  await waitIdle()
  assert.match(sent.at(-1)!.text, /Liên kết thành công/)

  await post(textUpdate('m3', 'mua cà phê 45k'))
  await post(textUpdate('m3', 'mua cà phê 45k')) // Zalo gửi lại → bỏ qua
  await waitIdle()
  assert.equal(agentCalls.length, 1)
  assert.deepEqual(agentCalls[0], { authUserId: authA, text: 'mua cà phê 45k', channel: 'zalo' })
  assert.equal(sent.at(-1)!.text, 'Đã ghi!')

  await post(textUpdate('m4', '/unlink'))
  await waitIdle()
  await post(textUpdate('m5', 'tổng tài sản'))
  await waitIdle()
  assert.equal(agentCalls.length, 1)
  assert.match(sent.at(-1)!.text, /chưa liên kết/)

  console.log(JSON.stringify({ ok: true }))
  sqlite.close()
}

async function runIsolated() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-ai-it-'))
  const dbPath = join(directory, 'ai-test.db')
  const filePath = fileURLToPath(import.meta.url)
  const child = Bun.spawn(['bun', 'run', filePath], { cwd: dirname(dirname(dirname(filePath))), env: { ...process.env, DATABASE_URL: `file:${dbPath}`, NODE_ENV: 'test', [CHILD]: '1' }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  try { assert.equal(exitCode, 0, `AI child failed\n${stdout}\n${stderr}`); assert(stdout.includes('"ok":true')) } finally { rmSync(directory, { recursive: true, force: true }) }
}

if (process.env[CHILD] === '1') await runChild()
else {
  const { describe, test } = await import('bun:test')
  describe('AI assistant + Zalo channel', () => { test('tools, memory, linking and webhook flow', runIsolated, 30_000) })
}
