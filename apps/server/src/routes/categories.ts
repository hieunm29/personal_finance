import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { categoryOrderSchema, createCategorySchema, updateCategorySchema } from '@pf/shared'
import {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategoryVisibility,
  deleteCategory,
  reorderCategories,
  getCategoryUsage,
} from '../services/categoryService'

type Variables = { userId: string }

const categoriesRoute = new Hono<{ Variables: Variables }>()

const querySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  showHidden: z.coerce.boolean().optional(),
})

const deleteQuerySchema = z.object({
  replacementCategoryId: z.string().uuid().optional(),
})

categoriesRoute.get('/', zValidator('query', querySchema), (c) => {
  const { type, showHidden } = c.req.valid('query')
  const authUserId = c.get('userId')
  const rows = getCategories(authUserId, type, showHidden)
  return c.json({ data: rows })
})

categoriesRoute.post('/', zValidator('json', createCategorySchema), (c) => {
  const data = c.req.valid('json')
  const authUserId = c.get('userId')
  const category = createCategory(authUserId, data)
  return c.json({ data: category }, 201)
})

categoriesRoute.patch('/order', zValidator('json', categoryOrderSchema), (c) => {
  reorderCategories(c.get('userId'), c.req.valid('json').items)
  return c.body(null, 204)
})

categoriesRoute.get('/:id/usage', (c) => {
  return c.json({ data: getCategoryUsage(c.get('userId'), c.req.param('id')) })
})

categoriesRoute.put('/:id', zValidator('json', updateCategorySchema), (c) => {
  const id = c.req.param('id')
  const data = c.req.valid('json')
  const authUserId = c.get('userId')
  const category = updateCategory(authUserId, id, data)
  return c.json({ data: category })
})

categoriesRoute.patch('/:id/visibility', (c) => {
  const id = c.req.param('id')
  const authUserId = c.get('userId')
  const category = toggleCategoryVisibility(authUserId, id)
  return c.json({ data: category })
})

categoriesRoute.delete('/:id', zValidator('query', deleteQuerySchema), (c) => {
  const id = c.req.param('id')
  const { replacementCategoryId } = c.req.valid('query')
  const authUserId = c.get('userId')
  deleteCategory(authUserId, id, replacementCategoryId)
  return c.body(null, 204)
})

export default categoriesRoute
