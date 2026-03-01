# Mẫu Hệ thống (System Patterns)

## Kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│                        BROWSER                           │
│  React 19 · Vite 6 · TailwindCSS 4 · React Router 7    │
│  TanStack Query · Zustand · react-hook-form + zod       │
│  better-auth/react (useSession, signIn, signOut)        │
└───────────────┬─────────────────────────────────────────┘
                │ fetch /api/* (credentials: include)
                │ Cookie: better-auth session
                ▼
┌─────────────────────────────────────────────────────────┐
│              HONO 4 (Bun native, :3000)                  │
│  logger → cors → /api/health                            │
│                → /api/auth/** (better-auth handler)     │
│                → auth middleware (getSession + userId)  │
│                → /api/settings/** (settingsRoutes)      │
│                → /api/transactions/** (TODO)            │
└───────────────┬─────────────────────────────────────────┘
                │ Drizzle ORM (bun:sqlite)
                ▼
┌─────────────────────────────────────────────────────────┐
│     SQLite — apps/server/data/app.db                    │
│  user · session · account · verification (better-auth) │
│  user_profiles · category_groups · categories          │
│  wallets · transactions · budgets · assets · ...       │
└─────────────────────────────────────────────────────────┘
```

## Folder Structure

```
Personal_Finance/
├── CLAUDE.md                         # Project rules
├── package.json                      # Bun workspaces root
├── docker-compose.yml / .dev.yml     # Deploy
├── packages/shared/src/
│   ├── types/index.ts               # TypeScript interfaces
│   ├── schemas/index.ts             # Zod schemas (signUpSchema, updateProfileSchema, ...)
│   └── constants/index.ts           # QUERY_KEYS, ROUTES, DEFAULT_CATEGORY_GROUPS
├── apps/web/src/
│   ├── App.tsx                      # BrowserRouter + Routes
│   ├── main.tsx                     # QueryClientProvider wrapper
│   ├── lib/auth-client.ts           # createAuthClient (better-auth/react)
│   ├── services/apiClient.ts        # fetch wrapper, credentials:include, 401→redirect
│   ├── components/layout/
│   │   ├── ProtectedRoute.tsx       # useSession guard → /login
│   │   └── AppLayout.tsx            # Header nav + Đăng xuất
│   ├── utils/
│   │   └── format.ts                # formatCurrency(cents, currency) + formatDate(str)
│   └── pages/
│       ├── LoginPage.tsx
│       ├── RegisterPage.tsx
│       ├── DashboardPage.tsx        # Placeholder
│       └── SettingsPage.tsx         # Profile + Currency + Change password
└── apps/server/src/
    ├── index.ts                     # Hono app entry
    ├── auth.ts                      # better-auth config + databaseHooks
    ├── db/
    │   ├── schema.ts                # 14 SQLite tables
    │   ├── index.ts                 # drizzle(sqlite, { schema })
    │   ├── seed.ts                  # Dev seed script
    │   └── migrations/              # Generated SQL migrations
    ├── services/
    │   ├── seedService.ts           # seedUserData() — profile + categories + wallet
    │   └── settingsService.ts       # getProfile() + updateProfile()
    ├── routes/
    │   └── settings.ts             # GET/PUT /api/settings/profile
    └── middleware/
        └── errorHandler.ts          # Zod→400, notFound→404, generic→500
```

## Key Patterns

### Backend Route (Hono)
```typescript
// apps/server/src/routes/settings.ts
const settings = new Hono<{ Variables: { userId: string } }>()
settings.get('/profile', (c) => {
  const profile = getProfile(c.get('userId'))  // userId từ auth middleware
  return c.json({ data: profile })
})
settings.put('/profile', zValidator('json', updateProfileSchema), (c) => {
  const data = c.req.valid('json')
  return c.json({ data: updateProfile(c.get('userId'), data) })
})
// Mount: app.route('/api/settings', settingsRoutes) — SAU app.use('/api/*', authMiddleware)
```

### Frontend API Call (TanStack Query)
```typescript
// useQuery — fetch data
const { data } = useQuery({
  queryKey: QUERY_KEYS.profile,
  queryFn: () => apiClient<{ data: UserProfile }>('/settings/profile'),
})
// useMutation — mutate then invalidate
const qc = useQueryClient()
await apiClient('/settings/profile', { method: 'PUT', body: data })
await qc.invalidateQueries({ queryKey: QUERY_KEYS.profile })
```

### Auth Client (better-auth/react)
```typescript
// lib/auth-client.ts
export const authClient = createAuthClient({ baseURL: 'http://localhost:3000' })

// Trong component:
const { data: session, isPending } = authClient.useSession()
await authClient.signUp.email({ email, password, name })
await authClient.signIn.email({ email, password })
await authClient.signOut()
await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: false })
```

### seedUserData (auto-seed khi đăng ký)
```typescript
// auth.ts — better-auth hook
databaseHooks: {
  user: { create: { after: async (user) => seedUserData(user.id, user.name) } }
}
// seedService.ts — idempotent
// 1. Check profile exists → return sớm
// 2. Create user_profiles (currency='VND', theme='system')
// 3. Seed DEFAULT_CATEGORY_GROUPS (8 groups, ~23 categories)
// 4. Create wallet "Tiền mặt" (cash, isDefault:true, balance:0)
```

### Error Response Format
```typescript
// Tất cả API errors: { error: { code: string, message: string } }
// 401: { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }
// 400 Zod: { error: { code: 'VALIDATION_ERROR', details: [...] } }
// 500: { error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } }
```

### Format Utilities
```typescript
// apps/web/src/utils/format.ts — Cached Intl formatters
formatCurrency(amountCents: number, currency = 'VND'): string
// VND: 150000000 → "1.500.000 ₫" | USD: 150000 → "$1,500.00" | EUR: 150000 → "1.500,00 €"
// NOTE: chia 100 trước khi format (stored as cents)

formatDate(dateString: string): string
// "2026-03-01" → "01/03/2026" (vi-VN locale)
// Append T00:00:00 nếu chỉ có date part để tránh timezone shift
```

## Cache Invalidation (TanStack Query)
| Mutation | Keys bị invalidate |
|:---|:---|
| profile update | `QUERY_KEYS.profile` |
| transaction CRUD | `['transactions']`, `['dashboard']` |
| category CRUD | `['categories']` |
| wallet CRUD | `['wallets']`, `['dashboard']` |
| budget CRUD | `['budgets']` |

## Routing
```
Public:    /login, /register
Protected: / (Dashboard), /settings
Guard: ProtectedRoute → useSession() → isPending→spinner, !session→/login, session→Outlet
Layout: AppLayout → Header (nav + email + Đăng xuất) + main Outlet
```
