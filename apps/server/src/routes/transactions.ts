import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  createTransactionSchema,
  createTransferSchema,
  updateTransactionSchema,
  transactionFilterSchema,
  transactionAnalyticsFilterSchema,
} from '@pf/shared'
import {
  createTransaction,
  createTransfer,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionAnalytics,
  exportTransactions,
} from '../services/transactionService'

type Variables = { userId: string }

const transactions = new Hono<{ Variables: Variables }>()

transactions.get('/analytics', zValidator('query', transactionAnalyticsFilterSchema), (c) => {
  const data = getTransactionAnalytics(c.get('userId'), c.req.valid('query'))
  return c.json({ data })
})

transactions.get('/export', zValidator('query', transactionAnalyticsFilterSchema), (c) => {
  const csv = exportTransactions(c.get('userId'), c.req.valid('query'))
  const date = new Date().toLocaleDateString('sv')
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="personal-finance_${date}.csv"`,
    'Cache-Control': 'no-store',
  })
})

transactions.get('/', zValidator('query', transactionFilterSchema), (c) => {
  const filters = c.req.valid('query')
  const result = getTransactions(c.get('userId'), filters)
  return c.json(result)
})

transactions.post('/', zValidator('json', createTransactionSchema), (c) => {
  const data = c.req.valid('json')
  const transaction = createTransaction(c.get('userId'), data)
  return c.json({ data: transaction }, 201)
})

// Chuyển tiền giữa 2 tài khoản của chính người dùng (rút ATM, nộp tiền, chuyển ngân hàng).
transactions.post('/transfer', zValidator('json', createTransferSchema), (c) => {
  const transaction = createTransfer(c.get('userId'), c.req.valid('json'))
  return c.json({ data: transaction }, 201)
})

transactions.get('/:id', (c) => {
  const transaction = getTransactionById(c.get('userId'), c.req.param('id'))
  return c.json({ data: transaction })
})

transactions.put('/:id', zValidator('json', updateTransactionSchema), (c) => {
  const data = c.req.valid('json')
  const transaction = updateTransaction(c.get('userId'), c.req.param('id'), data)
  return c.json({ data: transaction })
})

transactions.delete('/:id', (c) => {
  deleteTransaction(c.get('userId'), c.req.param('id'))
  return c.body(null, 204)
})

export default transactions
