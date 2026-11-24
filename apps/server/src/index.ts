import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import { auth } from './auth'
import { errorHandler } from './middleware/errorHandler'
import { sqlite } from './db'

type Variables = {
  userId: string
}

const app = new Hono<{ Variables: Variables }>()

// Global error handler
app.onError(errorHandler)

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// better-auth handler — handles /api/auth/*
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

// Zalo Bot webhook — nằm ngoài /api nên không qua middleware session;
// xác thực bằng header X-Bot-Api-Secret-Token bên trong route.
import { createZaloWebhook } from './channels/zalo/webhook'
app.route('/webhooks/zalo', createZaloWebhook().route)

// Auth middleware for all other /api/* routes
app.use('/api/*', async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401)
  c.set('userId', session.user.id)
  await next()
})

// Routes
import settingsRoutes from './routes/settings'
import transactionRoutes from './routes/transactions'
import categoriesRoutes from './routes/categories'
import categoryGroupsRoutes from './routes/category-groups'
import walletsRoutes from './routes/wallets'
import dashboardRoutes from './routes/dashboard'
import budgetRoutes from './routes/budget'
import assetRoutes from './routes/assets'
import reportRoutes from './routes/reports'
import recurringRoutes from './routes/recurring'
import integrationRoutes from './routes/integrations'
import { startJobs } from './jobs'

app.route('/api/settings', settingsRoutes)
app.route('/api/transactions', transactionRoutes)
app.route('/api/categories', categoriesRoutes)
app.route('/api/category-groups', categoryGroupsRoutes)
app.route('/api/wallets', walletsRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/budgets', budgetRoutes)
app.route('/api/assets', assetRoutes)
app.route('/api/reports', reportRoutes)
app.route('/api/recurring', recurringRoutes)
app.route('/api/recurring-templates', recurringRoutes)
app.route('/api/integrations', integrationRoutes)

// Job nền (giao dịch định kỳ, sao lưu hằng ngày…) chạy trong scheduler — xem jobs/index.ts.
// Timer được unref nên test và CLI ngắn hạn vẫn thoát sạch.
const jobs = startJobs()

// Dừng gọn khi Docker gửi SIGTERM (docker compose stop/restart): dừng job, gộp WAL vào file DB
// rồi đóng SQLite. Phải checkpoint tường minh: chỉ close() thì file -wal vẫn còn nguyên (đã đo).
function shutdown(signal: string) {
  console.log(`[server] nhận ${signal}, đang dừng…`)
  jobs?.stop()
  try {
    sqlite.run('PRAGMA wal_checkpoint(TRUNCATE)')
    sqlite.close()
  } catch (error) {
    console.error('[server] đóng SQLite lỗi', error)
  }
  process.exit(0)
}
if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './apps/web/dist' }))
  app.get('*', serveStatic({ path: './apps/web/dist/index.html' }))
}

// Bun native server
export default {
  port: parseInt(process.env.PORT ?? '3000'),
  fetch: app.fetch,
}

export { app }
