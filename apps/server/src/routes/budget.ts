import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createBudgetSchema, updateBudgetSchema, copyPreviousBudgetSchema } from '@pf/shared'
import {
  getBudget,
  upsertBudget,
  updateBudget,
  deleteBudget,
  copyPreviousBudget,
  getBudgetProgress,
  getBudgetHistory,
} from '../services/budgetService'

type Variables = { userId: string }
const budgetRoute = new Hono<{ Variables: Variables }>()

const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
})

budgetRoute.get('/history', (c) => {
  const history = getBudgetHistory(c.get('userId'))
  return c.json({ data: history })
})

budgetRoute.get('/progress', zValidator('query', monthQuerySchema), (c) => {
  const { month } = c.req.valid('query')
  const progress = getBudgetProgress(c.get('userId'), month)
  return c.json({ data: progress })
})

budgetRoute.get('/', zValidator('query', monthQuerySchema), (c) => {
  const { month } = c.req.valid('query')
  const budget = getBudget(c.get('userId'), month)
  return c.json({ data: budget })
})

budgetRoute.post('/', zValidator('json', createBudgetSchema), (c) => {
  const budget = upsertBudget(c.get('userId'), c.req.valid('json'))
  return c.json({ data: budget }, 201)
})

budgetRoute.post('/copy-previous', zValidator('json', copyPreviousBudgetSchema), (c) => {
  const budget = copyPreviousBudget(c.get('userId'), c.req.valid('json').targetMonth)
  return c.json({ data: budget }, 201)
})

budgetRoute.put('/:id', zValidator('json', updateBudgetSchema), (c) => {
  const budget = updateBudget(c.get('userId'), c.req.param('id'), c.req.valid('json'))
  return c.json({ data: budget })
})

budgetRoute.delete('/:id', (c) => {
  deleteBudget(c.get('userId'), c.req.param('id'))
  return c.body(null, 204)
})

export default budgetRoute
