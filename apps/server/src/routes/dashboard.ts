import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDashboardData } from '../services/dashboardService'

type Variables = { userId: string }

const app = new Hono<{ Variables: Variables }>()

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

app.get('/', zValidator('query', querySchema), (c) => {
  const { month } = c.req.valid('query')
  const currentMonth = new Date().toLocaleDateString('sv').substring(0, 7)
  const result = getDashboardData(c.get('userId'), month ?? currentMonth)
  return c.json({ data: result })
})

export default app
