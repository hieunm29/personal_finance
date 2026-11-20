import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { categoryGroupOrderSchema, createCategoryGroupSchema, updateCategoryGroupSchema } from '@pf/shared'
import {
  getCategoryGroups,
  createCategoryGroup,
  updateCategoryGroup,
  deleteCategoryGroup,
  reorderCategoryGroups,
} from '../services/categoryService'

type Variables = { userId: string }

const categoryGroupsRoute = new Hono<{ Variables: Variables }>()

const querySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
})

categoryGroupsRoute.get('/', zValidator('query', querySchema), (c) => {
  const { type } = c.req.valid('query')
  const authUserId = c.get('userId')
  const groups = getCategoryGroups(authUserId, type)
  return c.json({ data: groups })
})

categoryGroupsRoute.post('/', zValidator('json', createCategoryGroupSchema), (c) => {
  const data = c.req.valid('json')
  const authUserId = c.get('userId')
  const group = createCategoryGroup(authUserId, data)
  return c.json({ data: group }, 201)
})

categoryGroupsRoute.patch('/order', zValidator('json', categoryGroupOrderSchema), (c) => {
  reorderCategoryGroups(c.get('userId'), c.req.valid('json').items)
  return c.body(null, 204)
})

categoryGroupsRoute.put('/:id', zValidator('json', updateCategoryGroupSchema), (c) => {
  const id = c.req.param('id')
  const data = c.req.valid('json')
  const authUserId = c.get('userId')
  const group = updateCategoryGroup(authUserId, id, data)
  return c.json({ data: group })
})

categoryGroupsRoute.delete('/:id', (c) => {
  deleteCategoryGroup(c.get('userId'), c.req.param('id'))
  return c.body(null, 204)
})

export default categoryGroupsRoute
