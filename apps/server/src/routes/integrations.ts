import { Hono } from 'hono'
import { createLinkCode, getLinkStatus, unlink } from '../channels/zalo/linking'

type Variables = { userId: string }

/**
 * API cho web app quản lý liên kết Zalo (yêu cầu đăng nhập).
 *   POST   /api/integrations/zalo/link-code → { code, expiresAt }
 *   GET    /api/integrations/zalo/status    → { linked, displayName?, createdAt? }
 *   DELETE /api/integrations/zalo           → 204
 */
const integrations = new Hono<{ Variables: Variables }>()

integrations.post('/zalo/link-code', (c) => c.json(createLinkCode(c.get('userId')), 201))
integrations.get('/zalo/status', (c) => c.json(getLinkStatus(c.get('userId'))))
integrations.delete('/zalo', (c) => {
  unlink(c.get('userId'))
  return c.body(null, 204)
})

export default integrations
