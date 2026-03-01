import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { categories, categoryGroups, userProfiles } from '../db/schema'

type Variables = { userId: string }

const categoriesRoute = new Hono<{ Variables: Variables }>()

const querySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
})

categoriesRoute.get('/', zValidator('query', querySchema), (c) => {
  const { type } = c.req.valid('query')
  const authUserId = c.get('userId')

  const profile = db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId))
    .get()
  if (!profile) return c.json({ error: { message: 'Profile not found' } }, 404)

  const conditions = [eq(categories.userId, profile.id)]
  if (type) conditions.push(eq(categories.type, type))

  const rows = db
    .select({
      id: categories.id,
      userId: categories.userId,
      groupId: categories.groupId,
      name: categories.name,
      type: categories.type,
      icon: categories.icon,
      color: categories.color,
      isVisible: categories.isVisible,
      isDefault: categories.isDefault,
      sortOrder: categories.sortOrder,
      createdAt: categories.createdAt,
      group: {
        id: categoryGroups.id,
        name: categoryGroups.name,
        type: categoryGroups.type,
        color: categoryGroups.color,
        sortOrder: categoryGroups.sortOrder,
        isDefault: categoryGroups.isDefault,
      },
    })
    .from(categories)
    .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
    .where(and(...conditions))
    .orderBy(categoryGroups.sortOrder, categories.sortOrder)
    .all()

  return c.json({ data: rows })
})

export default categoriesRoute
