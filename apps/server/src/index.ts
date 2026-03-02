import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import { auth } from './auth'
import { errorHandler } from './middleware/errorHandler'

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
app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw))

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

app.route('/api/settings', settingsRoutes)
app.route('/api/transactions', transactionRoutes)
app.route('/api/categories', categoriesRoutes)
app.route('/api/category-groups', categoryGroupsRoutes)
app.route('/api/wallets', walletsRoutes)

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
