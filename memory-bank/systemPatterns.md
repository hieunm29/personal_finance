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
│                → /api/settings/**                       │
│                → /api/transactions/**                   │
│                → /api/categories/**                     │
│                → /api/wallets/**                        │
└───────────────┬─────────────────────────────────────────┘
                │ Drizzle ORM (bun:sqlite)
                ▼
┌─────────────────────────────────────────────────────────┐
│     SQLite — apps/server/data/app.db                    │
│  user · session · account · verification (better-auth) │
│  user_profiles · category_groups · categories          │
│  wallets · transactions · recurring_templates · ...    │
└─────────────────────────────────────────────────────────┘
```

## Folder Structure

```
Personal_Finance/
├── CLAUDE.md                         # Project rules
├── package.json                      # Bun workspaces root
├── docker-compose.yml / .dev.yml
├── packages/shared/src/
│   ├── types/index.ts               # TypeScript interfaces
│   ├── schemas/index.ts             # Zod schemas (signUpSchema, createTransactionSchema, ...)
│   └── constants/index.ts           # QUERY_KEYS, ROUTES, DEFAULT_CATEGORY_GROUPS
├── apps/web/src/
│   ├── App.tsx                      # BrowserRouter + Routes
│   ├── main.tsx                     # QueryClientProvider wrapper
│   ├── lib/auth-client.ts           # createAuthClient (better-auth/react)
│   ├── services/apiClient.ts        # fetch wrapper, credentials:include, 401→redirect, 204→null
│   ├── utils/format.ts              # formatCurrency(cents, currency) + formatDate(str)
│   ├── hooks/
│   │   ├── useTransactions.ts       # useTransactions/Create/Update/Delete + useTransaction
│   │   ├── useCategories.ts         # useCategories(type?)
│   │   └── useWallets.ts            # useWallets()
│   ├── components/layout/
│   │   ├── ProtectedRoute.tsx       # useSession guard → /login
│   │   └── AppLayout.tsx            # Header nav + Đăng xuất
│   ├── components/transaction/
│   │   ├── TransactionForm.tsx      # create + edit mode, react-hook-form
│   │   ├── TransactionFilters.tsx   # multi-criteria filter panel
│   │   ├── TransactionSearch.tsx    # debounce 300ms search
│   │   └── DeleteTransactionDialog.tsx
│   └── pages/
│       ├── LoginPage.tsx
│       ├── RegisterPage.tsx
│       ├── DashboardPage.tsx        # Placeholder
│       ├── SettingsPage.tsx
│       └── TransactionsPage.tsx     # List + filter + search + modals
└── apps/server/src/
    ├── index.ts                     # Hono app entry, route mounts
    ├── auth.ts                      # better-auth config + databaseHooks
    ├── db/schema.ts                 # 14 SQLite tables
    ├── db/index.ts                  # drizzle(sqlite, { schema })
    ├── services/
    │   ├── seedService.ts           # seedUserData() — profile + categories + wallet
    │   ├── settingsService.ts       # getProfile() + updateProfile()
    │   └── transactionService.ts    # createTransaction, getTransactions, update, delete
    ├── routes/
    │   ├── settings.ts              # GET/PUT /api/settings/profile
    │   ├── transactions.ts          # CRUD /api/transactions
    │   ├── categories.ts            # GET /api/categories?type=
    │   └── wallets.ts               # GET /api/wallets
    └── middleware/
        └── errorHandler.ts          # Zod→400, notFound→404, generic→500
```

## Key Patterns

### Backend Route (Hono)
```typescript
const transactions = new Hono<{ Variables: { userId: string } }>()
transactions.get('/', zValidator('query', transactionFilterSchema), (c) => {
  const filters = c.req.valid('query')
  const result = getTransactions(c.get('userId'), filters)
  return c.json(result)
})
transactions.delete('/:id', (c) => {
  deleteTransaction(c.get('userId'), c.req.param('id'))
  return c.body(null, 204)  // No Content
})
```

### Frontend API Hook (TanStack Query)
```typescript
// useQuery
export function useTransactions(filters: TransactionFilter) {
  return useQuery({
    queryKey: [...QUERY_KEYS.transactions, filters],
    queryFn: () => apiClient<TransactionsResponse>('/transactions?' + buildParams(filters)),
  })
}

// useMutation với invalidate
export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient<null>(`/transactions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard })
    },
  })
}
```

### apiClient — 204 No Content
```typescript
// apps/web/src/services/apiClient.ts
if (response.status === 204 || response.headers.get('content-length') === '0') {
  return null as T  // DELETE response có no body
}
return response.json() as T
```

### Edit/Create Mode Mutation Pattern
```typescript
// Không gọi hook có điều kiện — luôn init cả hai, chọn active
const createMutation = useCreateTransaction()
const updateMutation = useUpdateTransaction(transactionId ?? '')
const activeMutation = mode === 'edit' ? updateMutation : createMutation

const onSubmit = async (data) => {
  if (mode === 'edit') await updateMutation.mutateAsync(data)
  else await createMutation.mutateAsync(data)
  onSuccess?.()
}
```

### Search — Unicode-aware (tiếng Việt hoa/thường)
```typescript
// transactionService.ts — SQLite lower() chỉ ASCII → dùng JS filter
if (filters.search) {
  // Fetch tất cả rows khớp SQL filters (không paginate trong SQL)
  const searchLower = filters.search.toLowerCase()  // JS toLowerCase() xử lý đúng Unicode
  const allRows = baseQuery.all()
  const filtered = allRows.filter(r => r.note?.toLowerCase().includes(searchLower))
  // Paginate + aggregates từ filtered array
  total = filtered.length
  rows = filtered.slice((page - 1) * limit, page * limit)
  for (const r of filtered) {
    if (r.type === 'income') totalIncome += r.amount
    else if (r.type === 'expense') totalExpense += r.amount
  }
} else {
  // Không có search → SQL pagination (hiệu quả hơn)
  rows = baseQuery.limit(limit).offset((page - 1) * limit).all()
  // ... SQL COUNT + SUM aggregates
}
```

### Default Filter = Tháng Hiện Tại
```typescript
// TransactionsPage.tsx
function buildDefaultFilters(): TransactionFilter {
  const today = new Date()
  const dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('sv')
  const dateTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString('sv')
  return { page: 1, limit: 20, dateFrom, dateTo }
}
const DEFAULT_FILTERS = buildDefaultFilters()

// TransactionFilters.tsx — reset về tháng hiện tại, không phải về rỗng
const reset = () => onChange(defaultFilters ?? { page: 1, limit: filters.limit ?? 20 })
```

### Date Handling
```typescript
// Luôn dùng toLocaleDateString('sv') để có YYYY-MM-DD ở timezone local
// KHÔNG dùng toISOString() — bị UTC shift, dẫn đến ngày sai
new Date().toLocaleDateString('sv')  // → "2026-03-02" (local)

// formatDate: append T00:00:00 để tránh timezone shift khi parse
// "2026-03-01" → new Date("2026-03-01T00:00:00") → "01/03/2026"
```

### Auth Client (better-auth/react)
```typescript
export const authClient = createAuthClient({ baseURL: 'http://localhost:3000' })
const { data: session, isPending } = authClient.useSession()
await authClient.signIn.email({ email, password })
// Sau signIn/signUp: dùng window.location.href = '/' (KHÔNG navigate())
// → force full reload để sync better-auth session state
```

### seedUserData (auto-seed khi đăng ký)
```typescript
databaseHooks: {
  user: { create: { after: async (user) => seedUserData(user.id, user.name) } }
}
// Idempotent: check profile exists → return sớm
// Tạo: user_profiles (VND, system) + 8 category_groups + ~23 cats + wallet "Tiền mặt"
```

### Error Response Format
```typescript
// { error: { code: string, message: string } }
// 401: UNAUTHORIZED | 400: VALIDATION_ERROR + details | 500: INTERNAL_ERROR
```

## Cache Invalidation (TanStack Query)
| Mutation | Keys bị invalidate |
|:---|:---|
| transaction CRUD | `QUERY_KEYS.transactions`, `QUERY_KEYS.dashboard` |
| profile update | `QUERY_KEYS.profile` |
| category CRUD | `['categories']` |
| wallet CRUD | `['wallets']`, `QUERY_KEYS.dashboard` |

## Routing
```
Public:    /login, /register
Protected: / (Dashboard), /settings, /transactions
Guard: ProtectedRoute → useSession() → isPending→spinner, !session→/login, session→Outlet
Layout: AppLayout → Header (nav: Dashboard/Giao dịch/Cài đặt + email + Đăng xuất) + main Outlet
```

## Format Utilities
```typescript
// apps/web/src/utils/format.ts — Cached Intl formatters
formatCurrency(amountCents: number, currency = 'VND'): string
// VND: 150000000 → "1.500.000 ₫" | USD: 150000 → "$1,500.00"
// Chia 100 trước khi format (stored as cents)

formatDate(dateString: string): string
// "2026-03-01" → "01/03/2026" (vi-VN locale)
// Append T00:00:00 nếu chỉ có date part để tránh timezone shift
```
