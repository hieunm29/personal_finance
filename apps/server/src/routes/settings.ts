import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { updateProfileSchema } from '@pf/shared'
import { getProfile, updateProfile } from '../services/settingsService'

type Variables = { userId: string }

const settings = new Hono<{ Variables: Variables }>()

settings.get('/profile', (c) => {
  const profile = getProfile(c.get('userId'))
  return c.json({ data: profile })
})

settings.put(
  '/profile',
  zValidator('json', updateProfileSchema),
  (c) => {
    const data = c.req.valid('json')
    const profile = updateProfile(c.get('userId'), data)
    return c.json({ data: profile })
  },
)

export default settings
