import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { wallets, userProfiles } from '../db/schema'

type Variables = { userId: string }

const walletsRoute = new Hono<{ Variables: Variables }>()

walletsRoute.get('/', (c) => {
  const authUserId = c.get('userId')

  const profile = db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.authUserId, authUserId))
    .get()
  if (!profile) return c.json({ error: { message: 'Profile not found' } }, 404)

  const rows = db
    .select()
    .from(wallets)
    .where(eq(wallets.userId, profile.id))
    .orderBy(wallets.createdAt)
    .all()

  return c.json({ data: rows })
})

export default walletsRoute
