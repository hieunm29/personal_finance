import { defineConfig } from 'drizzle-kit'
import { resolve } from 'node:path'

// drizzle-kit chạy với CWD = apps/server/, cần resolve ./data/app.db từ đó
const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/app.db'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: resolve(dbPath),
  },
})
