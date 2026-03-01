import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionFilterSchema,
} from '@pf/shared'
import {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} from '../services/transactionService'

type Variables = { userId: string }

const transactions = new Hono<{ Variables: Variables }>()

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
