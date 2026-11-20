import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createRecurringSchema, updateRecurringSchema } from '@pf/shared'
import {
  createRecurring,
  deleteRecurring,
  generateDueTransactions,
  getRecurringById,
  getRecurringList,
  updateRecurring,
} from '../services/recurringService'

type Variables = { userId: string }
const recurring = new Hono<{ Variables: Variables }>()

recurring.post('/generate', (c) => c.json({ data: generateDueTransactions(c.get('userId')) }))
recurring.get('/', (c) => c.json({ data: getRecurringList(c.get('userId')) }))
recurring.post('/', zValidator('json', createRecurringSchema), (c) => {
  const data = createRecurring(c.get('userId'), c.req.valid('json'))
  return c.json({ data }, 201)
})
recurring.get('/:id', (c) => c.json({ data: getRecurringById(c.get('userId'), c.req.param('id')) }))
recurring.put('/:id', zValidator('json', updateRecurringSchema), (c) => {
  const data = updateRecurring(c.get('userId'), c.req.param('id'), c.req.valid('json'))
  return c.json({ data })
})
recurring.delete('/:id', (c) => {
  deleteRecurring(c.get('userId'), c.req.param('id'))
  return c.body(null, 204)
})

export default recurring
