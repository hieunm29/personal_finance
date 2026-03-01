# Mẫu Hệ thống (System Patterns)

## Kiến trúc Thực tế

```
┌──────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
│  React 19 · Vite 6 · TailwindCSS 4 · React Router 7         │
│  TanStack Query (server state) · Zustand (UI state)          │
│  @supabase/supabase-js (Auth trực tiếp)                      │
└────────────┬──────────────────────────────┬──────────────────┘
             │ fetch /api/*                 │ Supabase Auth SDK
             │ Authorization: Bearer JWT   │ (signUp, signIn)
             ▼                              ▼
┌────────────────────────┐   ┌─────────────────────────────────┐
│   VERCEL SERVERLESS    │   │         SUPABASE AUTH           │
│   Hono 4 · /api/*      │   │  JWT · refresh token · sessions │
│   logger→cors→auth     │   └─────────────────────────────────┘
│   →zod-validator        │
│   →route handler        │
│   →Drizzle ORM          │
└────────────┬────────────┘
             │ postgres-js (DATABASE_URL)
             ▼
┌────────────────────────────────────────────────────────────┐
│                  SUPABASE PostgreSQL                        │
│  user_profiles · category_groups · categories · wallets    │
│  transactions · recurring_templates · budgets              │
│  category_budgets · assets · asset_history                 │
└────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
Personal_Finance/
├── CLAUDE.md                    # Project rules cho Claude
├── package.json                 # Bun workspaces root
├── tsconfig.json                # TypeScript base config
├── bunfig.toml                  # Bun config
├── vercel.json                  # Deploy config
├── .env / .env.example          # Env vars
├── api/
│   └── index.ts                 # Vercel serverless entry (hono/vercel)
├── packages/
│   └── shared/                  # @pf/shared — dùng chung FE/BE
│       └── src/
│           ├── types/index.ts   # TypeScript interfaces (khớp DB schema)
│           ├── schemas/index.ts # Zod validation schemas
│           └── constants/index.ts # QUERY_KEYS, ROUTES, enums
├── apps/
│   ├── web/                     # @pf/web — React + Vite
│   │   ├── vite.config.ts       # Proxy /api → :3000, envDir → root
│   │   └── src/
│   │       ├── App.tsx          # Entry, router, auth guard
│   │       ├── main.tsx         # ReactDOM + QueryClientProvider
│   │       ├── index.css        # @import "tailwindcss" + @theme
│   │       └── services/
│   │           ├── supabase.ts  # Supabase client init
│   │           └── apiClient.ts # fetch wrapper với auth header
│   └── server/                  # @pf/server — Hono + Drizzle
│       ├── drizzle.config.ts    # Drizzle Kit config
│       └── src/
│           ├── index.ts         # Hono app + Bun native server export
│           └── db/
│               ├── schema.ts    # Drizzle schema (khớp với DB đã tạo)
│               └── index.ts     # DB connection (drizzle + postgres-js)
└── doc/                         # Tài liệu sản phẩm
```

## Key Patterns

### API Client (Frontend)
```typescript
// src/services/apiClient.ts
// Tự động inject Authorization: Bearer <token> từ Supabase session
apiClient<T>('/transactions', { method: 'POST', body: data })
```

### Hono Server
```typescript
// apps/server/src/index.ts
const app = new Hono().basePath('/api')
// Dev: export default { port: 3000, fetch: app.fetch } → Bun native server
// Prod: api/index.ts dùng handle(app) → Vercel serverless
```

### Drizzle ORM
```typescript
// apps/server/src/db/index.ts
const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
// Query: db.select().from(transactions).where(eq(transactions.userId, userId))
```

### Auth Flow
1. Frontend: `supabase.auth.signInWithPassword()` → nhận JWT
2. Frontend: gửi `Authorization: Bearer <token>` trong mọi API request
3. Backend auth middleware: `supabaseAdmin.auth.getUser(token)` → lấy userId
4. Backend: query DB với userId đã verify

### Cache Invalidation (TanStack Query)
| Mutation | Keys bị invalidate |
|:---|:---|
| transaction CRUD | `['transactions']`, `['dashboard']`, `['reports']` |
| category CRUD | `['categories']`, `['transactions']` |
| budget CRUD | `['budgets']`, `['dashboard']` |
| asset CRUD | `['assets']`, `['dashboard']` |
| wallet CRUD | `['wallets']`, `['dashboard']` |

## Database Schema (10 bảng)
```
user_profiles (1)
  └── category_groups (8) → categories (25)
  └── wallets (3)
  └── transactions (24) → [category, wallet, to_wallet?]
  └── recurring_templates
  └── budgets (1) → category_budgets (6) → [category]
  └── assets (10) → asset_history (6)
```
Test data: tháng 1 + 2/2026, user `test@example.com`
