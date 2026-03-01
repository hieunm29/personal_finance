# Tiến độ (Progress)

## Trạng thái Hiện tại
**Giai đoạn:** Phase 1 MVP — Authentication module 100% hoàn thành (US-AUTH-01 → 06 + Infrastructure Phần 7)
**Cập nhật:** 2026-03-01

---

## ✅ Đã Hoàn thành

### Stack Migration (Feb 28 → Mar 1)
- [x] Migration từ PostgreSQL/Supabase/Vercel → SQLite/better-auth/Docker Compose
- [x] `doc/3.techbase.md` — Cập nhật tech stack mới
- [x] `doc/4.database_prepare.md` — Cập nhật cho SQLite + Drizzle workflow

### Infrastructure
- [x] `apps/server/src/db/schema.ts` — 14 bảng SQLite (4 better-auth + 10 app)
- [x] `apps/server/src/db/index.ts` — bun:sqlite + Drizzle, WAL mode, FK ON
- [x] `apps/server/src/auth.ts` — better-auth config + databaseHooks
- [x] `apps/server/src/middleware/errorHandler.ts` — Zod→400, notFound→404, generic→500
- [x] `apps/server/src/index.ts` — Hono app, auth handler, auth middleware, routes
- [x] `apps/server/drizzle.config.ts` — dùng `resolve()` để fix path issue
- [x] DB migrations applied → `apps/server/data/app.db`

### Phase 1 — Authentication (US-AUTH-01 → 05)

#### US-AUTH-01: Đăng ký tài khoản ✅
- [x] `seedService.ts` — seedUserData() tạo profile + categories (8 groups, ~23 cats) + wallet
- [x] `auth.ts` databaseHooks.user.create.after → auto-seed khi đăng ký
- [x] `RegisterPage.tsx` — form email/password/confirmPassword + validation

#### US-AUTH-02: Đăng nhập ✅
- [x] better-auth handler `/api/auth/**` — built-in
- [x] `LoginPage.tsx` — form email/password + signIn.email()

#### US-AUTH-03: Đăng xuất ✅
- [x] `AppLayout.tsx` — nút Đăng xuất: signOut() + queryClient.clear() + navigate

#### US-AUTH-04: Tự động gia hạn phiên ✅
- [x] better-auth cookie sessions với auto-refresh (built-in)
- [x] `ProtectedRoute.tsx` — redirect /login khi session hết
- [x] `apiClient.ts` — bắt 401 → window.location.href = '/login'

#### US-AUTH-05: Quản lý hồ sơ cá nhân ✅
- [x] `settingsService.ts` — getProfile() + updateProfile()
- [x] `routes/settings.ts` — GET/PUT /api/settings/profile
- [x] `SettingsPage.tsx` — profile section + change password section
- [x] better-auth built-in `/api/auth/change-password`

#### US-AUTH-06: Cài đặt tiền tệ mặc định ✅
- [x] Currency selector (VND/USD/EUR) trong `SettingsPage.tsx` ProfileSection
- [x] `apps/web/src/utils/format.ts` — `formatCurrency(amountCents, currency)` + `formatDate(dateString)`
  - VND: 150000000 → "1.500.000 ₫" | USD: 150000 → "$1,500.00" | EUR: 150000 → "1.500,00 €"
  - Date: "2026-03-01" → "01/03/2026"

### Frontend Infrastructure (Phần 7) ✅
- [x] `lib/auth-client.ts` — createAuthClient + useSession/signIn/signUp/signOut hooks
- [x] `App.tsx` — BrowserRouter + Routes (public + protected)
- [x] `ProtectedRoute.tsx` — auth guard với loading spinner
- [x] `AppLayout.tsx` — header nav (Dashboard, Cài đặt) + email display + Đăng xuất
- [x] `DashboardPage.tsx` — placeholder
- [x] `middleware/errorHandler.ts` — Zod→400, notFound→404, generic→500
- [x] Routes: `/`, `/login`, `/register`, `/settings`

---

## 🔲 Còn Lại — Phase 1 MVP

### Module 2: Transactions (Tiếp theo)
- [ ] Backend: transactionService + routes
- [ ] Frontend: TransactionList, TransactionForm, filters

### Module 3: Categories
- [ ] Backend: categoryService + routes
- [ ] Frontend: CategoryList, CategoryForm

### Module 4: Dashboard
- [ ] Backend: dashboardService (tổng thu/chi tháng, số dư)
- [ ] Frontend: DashboardPage đầy đủ với charts

---

## Các Vấn đề Đã biết
- `drizzle-kit migrate` không chạy được với Bun (dùng `better-sqlite3`) → dùng `push` hoặc apply SQL trực tiếp qua bun:sqlite
- DB path: server dùng `apps/server/data/app.db` (CWD = apps/server/), drizzle.config.ts cần `resolve()` để đúng path
- better-auth `/api/auth/**` yêu cầu `Origin` header (CSRF) — browser tự gửi, curl test phải thêm `-H "Origin: http://localhost:5173"`
- Port conflict: `lsof -ti:5173,3000 | xargs kill -9`
