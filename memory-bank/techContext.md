# Ngữ cảnh Kỹ thuật (Tech Context)

## Stack Chính thức

| Tầng | Công nghệ | Phiên bản | Ghi chú |
|:---|:---|:---|:---|
| **Runtime** | Bun | 1.3.10 | `~/.bun/bin/bun` |
| **Frontend** | React + TypeScript | 19.0.0 | |
| **Build tool** | Vite | 6.4.1 | |
| **CSS** | TailwindCSS | 4.0.7 | `@tailwindcss/vite` |
| **Routing** | React Router | 7.2.0 | import từ `react-router` |
| **Server state** | TanStack Query | 5.65.1 | |
| **Client state** | Zustand | 5.0.3 | |
| **Forms** | react-hook-form + zod | 7.54.2 / 3.23.8 | |
| **Charts** | Chart.js + react-chartjs-2 | 4.4.8 / 5.3.0 | |
| **Backend** | Hono | 4.6.20 | Bun native server |
| **ORM** | Drizzle ORM | 0.45.1 | SQLite dialect |
| **Database** | SQLite | — | `bun:sqlite`, file `apps/server/data/app.db` |
| **Auth** | better-auth | 1.4.20 | Self-hosted, cookie-based sessions |
| **Deploy** | Docker Compose | — | `docker-compose.yml` + `docker-compose.dev.yml` |

## Database

### Path Resolution (quan trọng)
- Server runtime CWD = `apps/server/` → `./data/app.db` → `apps/server/data/app.db`
- `drizzle.config.ts` dùng `resolve(process.env.DATABASE_URL?.replace('file:','') || './data/app.db')` để luôn đúng
- `drizzle-kit migrate` KHÔNG chạy được với Bun → dùng `drizzle-kit push` hoặc apply SQL thủ công

### Schema (14 bảng)
```
better-auth tables: user, session, account, verification
app tables:
  user_profiles → category_groups → categories
              └── wallets
              └── transactions → [category, wallet, to_wallet?]
              └── recurring_templates
              └── budgets → category_budgets → [category]
              └── assets → asset_history
```

### Monetary values: integer cents (VND: nhân 100, không dùng float)

## Auth Flow (better-auth)
```
Frontend                    Backend (better-auth)
   │                              │
   ├─ signUp.email() ────────────→ POST /api/auth/sign-up/email
   │                              ├─ tạo user trong bảng `user`
   │                              └─ databaseHooks.after → seedUserData()
   │                                  ├─ tạo user_profiles
   │                                  ├─ seed 8 category_groups + ~23 categories
   │                                  └─ tạo wallet "Tiền mặt"
   │
   ├─ signIn.email() ────────────→ POST /api/auth/sign-in/email → set cookie
   │
   ├─ useSession() ──────────────→ GET /api/auth/get-session (cache 5min)
   │
   └─ signOut() ─────────────────→ POST /api/auth/sign-out → clear cookie
```

## Server Request Flow
```
Request → logger() → cors() → /api/health (bypass)
                            → /api/auth/** (better-auth handler, bypass auth middleware)
                            → app.use('/api/*') auth middleware
                                └─ getSession() → set userId → next()
                            → /api/settings/**    (settingsRoutes)
                            → /api/transactions/** (transactionRoutes)
                            → /api/categories/**  (categoryRoutes)
                            → /api/wallets/**     (walletRoutes)
```

## Env Vars
| Var | Trạng thái | Ghi chú |
|:---|:---:|:---|
| `DATABASE_URL=file:./data/app.db` | ✅ | SQLite local file |
| `BETTER_AUTH_SECRET` | ✅ | Random 32+ chars |
| `BETTER_AUTH_URL=http://localhost:3000` | ✅ | |
| `FRONTEND_URL=http://localhost:5173` | ✅ | CORS + trustedOrigins |
| `VITE_API_URL=http://localhost:3000` | ✅ | Frontend API base |

## Design System (TailwindCSS 4)
```css
/* apps/web/src/index.css */
@theme {
  --color-primary: #3b82f6;
  --color-primary-dark: #1d4ed8;
  --color-income: #16a34a;
  --color-expense: #ef4444;
  --color-transfer: #f59e0b;
}
```

## Dev Commands
```bash
bun run dev:web      # → http://localhost:5173
bun run dev:server   # → http://localhost:3000/api/health
bun run db:generate  # Generate Drizzle migrations
bun run typecheck    # All packages typecheck
# Apply migration manually (nếu push không dùng được):
bun -e 'const {Database}=require("bun:sqlite"); ...'
```
