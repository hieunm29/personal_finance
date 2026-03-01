import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db'
import { seedUserData } from './services/seedService'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/api/auth',
  emailAndPassword: { enabled: true },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  trustedOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await seedUserData(user.id, user.name)
        },
      },
    },
  },
})
