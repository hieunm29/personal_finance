# Tiến độ (Progress)

## Trạng thái Hiện tại
**Giai đoạn:** Phase 1 MVP — Transaction Engine hoàn thành (US-TXN-01 → 07)
**Cập nhật:** 2026-03-02

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

### Phase 1 — Authentication (US-AUTH-01 → 06) ✅

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

### Frontend Infrastructure (Phần 7) ✅
- [x] `lib/auth-client.ts` — createAuthClient + useSession/signIn/signUp/signOut hooks
- [x] `App.tsx` — BrowserRouter + Routes (public + protected)
- [x] `ProtectedRoute.tsx` — auth guard với loading spinner
- [x] `AppLayout.tsx` — header nav (Dashboard, Giao dịch, Cài đặt) + email + Đăng xuất
- [x] Routes: `/`, `/login`, `/register`, `/settings`, `/transactions`

### Phase 1 — Transaction Engine (US-TXN-01 → 07) ✅

#### Phần 0 — Infrastructure chung ✅
- [x] `packages/shared/src/schemas/index.ts` — createTransactionSchema, updateTransactionSchema, transactionFilterSchema, createRecurringSchema
- [x] `packages/shared/src/types/index.ts` — Transaction, TransactionWithRelations, RecurringTemplate, PaginatedResponse
- [x] `apps/server/src/services/transactionService.ts` — createTransaction, getTransactions, getTransactionById, updateTransaction, deleteTransaction
- [x] `apps/server/src/routes/transactions.ts` — GET/POST/GET:id/PUT:id/DELETE:id
- [x] `apps/server/src/routes/categories.ts` — GET /api/categories?type=
- [x] `apps/server/src/routes/wallets.ts` — GET /api/wallets
- [x] Mount tất cả routes trong `index.ts`

#### US-TXN-01 & 02: Thêm giao dịch chi tiêu + thu nhập ✅
- [x] `hooks/useTransactions.ts` — useCreateTransaction()
- [x] `hooks/useCategories.ts` — useCategories(type?)
- [x] `hooks/useWallets.ts` — useWallets()
- [x] `components/transaction/TransactionForm.tsx` — type toggle, amount (VND format), category grouped select, wallet select, date, note

#### US-TXN-03: Xem danh sách giao dịch ✅
- [x] `hooks/useTransactions.ts` — useTransactions(filters)
- [x] `pages/TransactionsPage.tsx` — grouped by date, pagination, summary bar (Thu/Chi), skeleton

#### US-TXN-04: Chỉnh sửa giao dịch ✅
- [x] `hooks/useTransactions.ts` — useTransaction(id), useUpdateTransaction(id)
- [x] `TransactionForm.tsx` mode='edit' — type disabled, pre-fill defaultValues

#### US-TXN-05: Xóa giao dịch ✅
- [x] `hooks/useTransactions.ts` — useDeleteTransaction()
- [x] `components/transaction/DeleteTransactionDialog.tsx` — confirm dialog
- [x] `apiClient.ts` — xử lý 204 No Content (không gọi response.json())

#### US-TXN-06: Lọc giao dịch ✅
- [x] `components/transaction/TransactionFilters.tsx` — type tabs, date range, category, amount range
- [x] Default filter = tháng hiện tại (buildDefaultFilters)
- [x] "Xóa bộ lọc" → reset về DEFAULT_FILTERS (tháng hiện tại, không phải về rỗng)

#### US-TXN-07: Tìm kiếm giao dịch ✅
- [x] `components/transaction/TransactionSearch.tsx` — debounce 300ms, sync reset
- [x] Backend: search dùng JS-side filter (Unicode-aware, hỗ trợ tiếng Việt hoa/thường)

---

### Phase 1 — Category Management (US-CAT-01 → 07) ✅

#### Phần 0 — Infrastructure chung ✅
- [x] `packages/shared/src/schemas/index.ts` — updateCategoryGroupSchema, deleteCategorySchema; fixed updateCategorySchema (chỉ name/icon/color)
- [x] `packages/shared/src/types/index.ts` — CategoryGroupWithCategories
- [x] `apps/server/src/services/categoryService.ts` — getCategories, getCategoryGroups, createCategory, updateCategory, toggleVisibility, deleteCategory, createCategoryGroup, updateCategoryGroup
- [x] `apps/server/src/routes/categories.ts` — GET(+showHidden) / POST / PUT/:id / PATCH/:id/visibility / DELETE/:id
- [x] `apps/server/src/routes/category-groups.ts` — GET / POST / PUT/:id
- [x] `apps/server/src/index.ts` — mount /api/category-groups
- [x] `apps/server/src/middleware/errorHandler.ts` — handle status 400/404/409 from services
- [x] `apps/web/src/hooks/useCategories.ts` — useCreateCategory, useUpdateCategory, useToggleCategoryVisibility, useDeleteCategory, showHidden param
- [x] `apps/web/src/hooks/useCategoryGroups.ts` — useCategoryGroups, useCreateCategoryGroup, useUpdateCategoryGroup
- [x] `apps/web/src/App.tsx` — route /categories
- [x] `apps/web/src/components/layout/AppLayout.tsx` — nav link "Danh mục"

#### US-CAT-01: Danh mục mặc định ✅
- [x] seedService.ts — seed 8 groups ~23 categories khi đăng ký (isDefault:true)

#### US-CAT-02: Xem danh sách danh mục ✅
- [x] `pages/CategoriesPage.tsx` — 2 tab (Chi tiêu/Thu nhập), grouped by group, badge Ẩn, opacity-50

#### US-CAT-03: Thêm danh mục tùy chỉnh ✅
- [x] CategoryForm (create mode) — type toggle, group select, name, icon preset, color preset
- [x] Backend unique name check → 409 Conflict

#### US-CAT-04: Sửa danh mục ✅
- [x] CategoryForm (edit mode) — type/group disabled, pre-fill name/icon/color

#### US-CAT-05: Ẩn danh mục ✅
- [x] Toggle 👁/🙈 → PATCH /categories/:id/visibility

#### US-CAT-06: Xóa danh mục tùy chỉnh ✅
- [x] DeleteCategoryDialog — nếu có transactions bắt chọn replacement, Xóa disabled cho đến khi chọn
- [x] Backend re-assigns transactions trước khi xóa

#### US-CAT-07: Tạo nhóm danh mục mới ✅
- [x] CategoryGroupForm (create + edit) — tên, loại, màu
- [x] Nhóm rỗng hiện trong danh sách (useCategoryGroups seed vào groupByGroup)
- [x] Nhóm tùy chỉnh có nút ✏️ trên group header

---

## 🔲 Còn Lại — Phase 1 MVP

### Module 2: Transactions Phase 2
- [ ] US-TXN-08: Giao dịch định kỳ (recurringService + RecurringPage)
- [ ] US-TXN-09: Xuất dữ liệu CSV

### Module 4: Dashboard
- [ ] Backend: dashboardService (tổng thu/chi tháng, số dư)
- [ ] Frontend: DashboardPage đầy đủ với charts

---

## Các Vấn đề Đã biết
- `drizzle-kit migrate` không chạy được với Bun → dùng `push` hoặc apply SQL trực tiếp
- DB path: server dùng `apps/server/data/app.db`; drizzle.config.ts cần `resolve()`
- better-auth `/api/auth/**` yêu cầu `Origin` header (CSRF)
- SQLite `lower()` là ASCII-only — search tiếng Việt phải làm ở JS (xem systemPatterns)
- Port conflict: `lsof -ti:5173,3000 | xargs kill -9`
- Dev server crash sẽ mất session cookie → cần đăng nhập lại
