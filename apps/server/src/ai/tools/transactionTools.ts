import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../../db'
import { aiActions } from '../../db/schema'
import { createTransaction, createTransfer, deleteTransaction, getTransactions } from '../../services/transactionService'
import { getDefaultAccountId, getProfileIdByAuthUser, getUserFinanceContext } from '../userContext'
import { centsToVnd, clampNote, json, MAX_NOTE_LENGTH, todayVN, toolFail, vndToCents } from './helpers'
import type { ToolContext } from './index'

/**
 * Các tool liên quan đến giao dịch.
 *
 * Mỗi tool gồm:
 *  - name / description: "hướng dẫn sử dụng" để Claude biết KHI NÀO và CÁCH gọi tool
 *  - inputSchema: JSON Schema của tham số — SDK dùng nó để validate input trước khi chạy `run`
 *  - run: code thật, gọi lại service có sẵn của dự án
 *
 * Lưu ý bảo mật: authUserId lấy từ `ctx` (do server xác định qua bảng zalo_links),
 * KHÔNG nằm trong inputSchema → model không thể truy cập dữ liệu người khác.
 */
export function buildTransactionTools(ctx: ToolContext) {
  const createTransactionTool = betaTool({
    name: 'create_transaction',
    description:
      'Ghi một giao dịch thu hoặc chi mới vào sổ của người dùng. Dùng khi người dùng kể đã mua/tiêu/trả/nhận tiền ' +
      '(ví dụ "mua cà phê 45k", "nhận lương 20 triệu", "được thưởng 2tr"). ' +
      'Chỉ gọi khi đã biết rõ số tiền. Chọn categoryId từ danh sách danh mục trong system prompt, đúng loại income/expense.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'], description: 'income = thu, expense = chi' },
        amountVnd: { type: 'integer', minimum: 1, description: 'Số tiền bằng VND nguyên, ví dụ 45k → 45000, 2tr → 2000000' },
        categoryId: { type: 'string', description: 'id danh mục lấy từ danh sách trong system prompt' },
        walletId: { type: 'string', description: 'id ví/tài khoản; bỏ trống để dùng ví mặc định' },
        date: { type: 'string', description: 'YYYY-MM-DD; bỏ trống = hôm nay. "hôm qua" → lùi 1 ngày' },
        note: {
          type: 'string',
          maxLength: MAX_NOTE_LENGTH,
          description:
            'Ghi chú ngắn bằng lời của người dùng, ví dụ "Cà phê Highlands". ' +
            'Hóa đơn mua hàng: "Tên cửa hàng: Món 1 60.000; Món 2 18.900; …" (tối đa 500 ký tự)',
        },
      },
      required: ['type', 'amountVnd', 'categoryId'],
      additionalProperties: false,
    },
    run: async (input) => {
      const userContext = getUserFinanceContext(ctx.authUserId)
      const walletId = input.walletId || getDefaultAccountId(userContext)
      if (!walletId) toolFail('Người dùng chưa có ví nào. Hãy hướng dẫn họ tạo ví trên web trước.')
      const category = userContext.categories.find((item) => item.id === input.categoryId)
      if (!category) toolFail(`categoryId "${input.categoryId}" không tồn tại. Chọn lại từ danh sách trong system prompt.`)
      if (category.type !== input.type) toolFail(`Danh mục "${category.name}" là loại ${category.type}, không khớp với ${input.type}.`)

      const created = createTransaction(ctx.authUserId, {
        type: input.type,
        amount: vndToCents(input.amountVnd),
        categoryId: input.categoryId,
        walletId,
        date: input.date || todayVN(),
        note: clampNote(input.note),
        isRecurring: false,
      })

      const summary = `${input.type === 'income' ? 'Thu' : 'Chi'} ${input.amountVnd.toLocaleString('vi-VN')}đ - ${category.name}`
      db.insert(aiActions).values({
        userId: getProfileIdByAuthUser(ctx.authUserId),
        kind: 'create_transaction',
        refId: created.id,
        summary,
      }).run()

      return json({
        ok: true,
        transactionId: created.id,
        type: created.type,
        amountVnd: centsToVnd(created.amount),
        category: created.category?.name,
        account: created.wallet?.name ?? created.asset?.name,
        date: created.date,
        note: created.note,
      })
    },
  })

  const undoLastActionTool = betaTool({
    name: 'undo_last_action',
    description:
      'Hoàn tác (xóa) giao dịch hoặc chuyển khoản gần nhất mà trợ lý đã ghi qua chat; số dư tài khoản được trả lại. ' +
      'Dùng khi người dùng nói "hoàn tác", "xóa cái vừa rồi", "nhầm rồi".',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const profileId = getProfileIdByAuthUser(ctx.authUserId)
      const last = db.select().from(aiActions)
        .where(and(eq(aiActions.userId, profileId), inArray(aiActions.kind, ['create_transaction', 'create_transfer']), isNull(aiActions.undoneAt)))
        .orderBy(desc(sql`rowid`)) // thứ tự chèn, chính xác hơn created_at (theo giây)
        .get()
      if (!last) toolFail('Không có giao dịch nào do trợ lý ghi để hoàn tác.')
      try {
        deleteTransaction(ctx.authUserId, last.refId)
      } catch (error) {
        // Giao dịch đã bị xóa trên web → vẫn đánh dấu đã hoàn tác.
        if ((error as { status?: number }).status !== 404) throw error
      }
      db.update(aiActions).set({ undoneAt: new Date().toISOString() }).where(eq(aiActions.id, last.id)).run()
      return json({ ok: true, undone: last.summary })
    },
  })

  const createTransferTool = betaTool({
    name: 'create_transfer',
    description:
      'Chuyển tiền giữa 2 tài khoản của CHÍNH người dùng: rút tiền ngân hàng về tiền mặt, nộp tiền mặt vào ngân hàng, ' +
      'chuyển giữa 2 ngân hàng, nạp ví điện tử. Tài khoản nguồn bị trừ, đích được cộng; KHÔNG tính là thu hay chi. ' +
      'Không dùng cho chuyển tiền cho người khác (đó là khoản chi → create_transaction). ' +
      'Lấy fromAccountId/toAccountId từ danh sách tài khoản trong system prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        fromAccountId: { type: 'string', description: 'id tài khoản nguồn (dạng asset-...)' },
        toAccountId: { type: 'string', description: 'id tài khoản đích (dạng asset-...)' },
        amountVnd: { type: 'integer', minimum: 1, description: 'Số tiền bằng VND nguyên, ví dụ 2 củ → 2000000' },
        date: { type: 'string', description: 'YYYY-MM-DD; bỏ trống = hôm nay' },
        note: { type: 'string', description: 'Ghi chú ngắn, ví dụ "Rút ATM"' },
      },
      required: ['fromAccountId', 'toAccountId', 'amountVnd'],
      additionalProperties: false,
    },
    run: async (input) => {
      const accounts = getUserFinanceContext(ctx.authUserId).accounts
      const from = accounts.find((account) => account.id === input.fromAccountId)
      const to = accounts.find((account) => account.id === input.toAccountId)
      if (!from || from.kind === 'wallet') toolFail(`fromAccountId "${input.fromAccountId}" không phải tài khoản tiền mặt/ngân hàng trong danh sách.`)
      if (!to || to.kind === 'wallet') toolFail(`toAccountId "${input.toAccountId}" không phải tài khoản tiền mặt/ngân hàng trong danh sách.`)
      if (from.id === to.id) toolFail('Tài khoản nguồn và đích trùng nhau.')

      // Lỗi nghiệp vụ (vd số dư không đủ) từ service được gửi lại cho model để báo người dùng.
      const created = createTransfer(ctx.authUserId, {
        fromAccountId: from.id,
        toAccountId: to.id,
        amount: vndToCents(input.amountVnd),
        date: input.date || todayVN(),
        note: input.note,
      })

      const summary = `Chuyển ${input.amountVnd.toLocaleString('vi-VN')}đ: ${from.name} → ${to.name}`
      db.insert(aiActions).values({
        userId: getProfileIdByAuthUser(ctx.authUserId),
        kind: 'create_transfer',
        refId: created.id,
        summary,
      }).run()

      return json({
        ok: true,
        transactionId: created.id,
        amountVnd: centsToVnd(created.amount),
        from: from.name,
        to: to.name,
        fromBalanceVnd: centsToVnd(created.asset?.currentValue ?? 0),
        toBalanceVnd: centsToVnd(created.toAsset?.currentValue ?? 0),
        date: created.date,
      })
    },
  })

  const searchTransactionsTool = betaTool({
    name: 'search_transactions',
    description:
      'Tìm giao dịch theo khoảng ngày, loại, danh mục hoặc từ khóa. Trả về tổng thu/chi và tối đa 20 giao dịch gần nhất. ' +
      'Dùng cho câu hỏi như "tuần này ăn uống hết bao nhiêu", "hôm qua tôi tiêu gì".',
    inputSchema: {
      type: 'object',
      properties: {
        dateFrom: { type: 'string', description: 'YYYY-MM-DD' },
        dateTo: { type: 'string', description: 'YYYY-MM-DD' },
        type: { type: 'string', enum: ['income', 'expense'] },
        categoryId: { type: 'string' },
        keyword: { type: 'string', description: 'Từ khóa tìm trong ghi chú/tên danh mục' },
      },
      additionalProperties: false,
    },
    run: async (input) => {
      const result = getTransactions(ctx.authUserId, {
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        type: input.type,
        categoryId: input.categoryId,
        search: input.keyword,
        page: 1,
        limit: 20,
      })
      return json({
        total: result.meta.total,
        totalIncomeVnd: centsToVnd(result.meta.totalIncome),
        totalExpenseVnd: centsToVnd(result.meta.totalExpense),
        items: result.data.map((row) => ({
          date: row.date,
          type: row.type,
          amountVnd: centsToVnd(row.amount),
          category: row.category?.name,
          note: row.note,
        })),
      })
    },
  })

  return [createTransactionTool, undoLastActionTool, searchTransactionsTool, createTransferTool]
}
