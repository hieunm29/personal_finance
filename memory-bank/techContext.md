# Ngữ cảnh Kỹ thuật (Tech Context)

## Stack Chính thức (đã quyết định)

| Tầng | Công nghệ | Phiên bản | Ghi chú |
|:---|:---|:---|:---|
| **Runtime (dev)** | Bun | 1.3.10 | `~/.bun/bin/bun` |
| **Frontend** | React + TypeScript | 19.0.0 | |
| **Build tool** | Vite | 6.4.1 | |
| **CSS** | TailwindCSS | 4.0.7 | Plugin: `@tailwindcss/vite` |
| **Routing** | React Router | 7.2.0 | Import từ `react-router` |
| **Server state** | TanStack Query | 5.65.1 | |
| **Client state** | Zustand | 5.0.3 | |
| **Forms** | react-hook-form + zod | 7.54.2 / 3.23.8 | |
| **Charts** | Chart.js + react-chartjs-2 | 4.4.8 / 5.3.0 | |
| **Backend** | Hono | 4.6.20 | `.basePath('/api')` |
| **ORM** | Drizzle ORM | 0.39.3 | |
| **DB Driver** | postgres (postgres-js) | 3.4.5 | |
| **Database** | PostgreSQL | 17.6 | Supabase managed |
| **Auth** | Supabase Auth | @supabase/supabase-js 2.47.10 | |
| **Deploy** | Vercel | — | Frontend static + Serverless BE |

## Supabase Project
- **Project:** supabase-red-canvas
- **Project ID:** `feqhoszergbdxadluctn`
- **Region:** ap-southeast-1 (Singapore)
- **URL:** `https://feqhoszergbdxadluctn.supabase.co`
- **Anon Key:** trong `.env` (VITE_SUPABASE_ANON_KEY)

## Thiết lập Dev

### Lệnh chạy
```bash
bun run dev:web     # Vite → http://localhost:5173
bun run dev:server  # Hono → http://localhost:3000/api/health
bun install         # Install tất cả packages
```

### Môi trường
- OS: macOS darwin 25.2.0
- Editor: Neovim + LazyVim
- Bun: 1.3.10 tại `~/.bun/bin/bun`
- PATH chú ý: `bun` không có trong PATH shell mặc định — dùng đường dẫn đầy đủ

### Vite Proxy (dev)
```
Frontend :5173 → /api/* → Backend :3000
```
Cấu hình trong `apps/web/vite.config.ts`, `envDir` trỏ về root monorepo.

## Kiến trúc Deployment (Vercel)
```
apps/web/dist/    ← Vite static build
api/index.ts      ← Hono serverless function (Node.js 20.x)
```
Rewrite: `/api/(.*)` → `/api`

## Env Vars Cần thiết
| Var | Nơi dùng | Trạng thái |
|:---|:---|:---|
| `SUPABASE_URL` | Server | ✅ điền rồi |
| `SUPABASE_ANON_KEY` | Server + Vite | ✅ điền rồi |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (auth verify) | ❌ chưa có |
| `DATABASE_URL` | Server (Drizzle) | ❌ cần DB password |
| `VITE_SUPABASE_URL` | Frontend | ✅ điền rồi |
| `VITE_SUPABASE_ANON_KEY` | Frontend | ✅ điền rồi |

## Design System (TailwindCSS 4)
```css
/* apps/web/src/index.css */
@theme {
  --color-primary: #3b82f6;
  --color-income: #16a34a;
  --color-expense: #ef4444;
  --color-transfer: #f59e0b;
}
```
