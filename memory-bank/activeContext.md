# Ngữ cảnh Hoạt động (Active Context)

## Trọng tâm Công việc Hiện tại
**Giai đoạn:** Phase 1 MVP — Transaction Engine (US-TXN-01→07) vừa hoàn thành.
**Tiếp theo:** US-TXN-08 Recurring (Phase 2) hoặc Module 3 Categories / Module 4 Dashboard.

---

## Các Thay đổi Gần đây (2026-03-02)

### Transaction Engine hoàn thành (US-TXN-01→07)

**Backend** (`apps/server/src/`):
- `services/transactionService.ts` — CRUD + getTransactions (filter đầy đủ, aggregates totalIncome/totalExpense)
- `routes/transactions.ts` — REST endpoints GET/POST/GET:id/PUT:id/DELETE:id
- `routes/categories.ts` — GET /api/categories?type=
- `routes/wallets.ts` — GET /api/wallets
- `services/apiClient.ts` — fix 204 No Content (DELETE response)

**Frontend** (`apps/web/src/`):
- `hooks/useTransactions.ts` — useTransactions, useCreateTransaction, useTransaction, useUpdateTransaction, useDeleteTransaction
- `hooks/useCategories.ts`, `hooks/useWallets.ts`
- `components/transaction/TransactionForm.tsx` — create + edit mode
- `components/transaction/TransactionFilters.tsx` — multi-criteria filter panel
- `components/transaction/TransactionSearch.tsx` — debounce 300ms
- `components/transaction/DeleteTransactionDialog.tsx`
- `pages/TransactionsPage.tsx` — danh sách grouped, pagination, modal create/edit/delete

**Quyết định kỹ thuật quan trọng:**
- Default filter = tháng hiện tại (`buildDefaultFilters` dùng `new Date(y, m, 1)` / `new Date(y, m+1, 0)`)
- "Xóa bộ lọc" reset về DEFAULT_FILTERS (tháng hiện tại), không phải về rỗng
- Search: SQLite `lower()` ASCII-only → JS-side `.toLowerCase().includes()` (xem systemPatterns)
- apiClient fix: check `response.status === 204` trước `response.json()`
- Edit mode: `activeMutation = mode === 'edit' ? updateMutation : createMutation`

---

## Các Bước Tiếp theo

### Option A — Phase 2 Transaction
1. **US-TXN-08:** Recurring Templates (recurringService, RecurringPage)
2. **US-TXN-09:** Export CSV

### Option B — Module 3: Categories (CRUD)
1. Backend: categoryService (create, update, delete, reorder)
2. Frontend: CategoryPage với list + form

### Option C — Module 4: Dashboard
1. Backend: dashboardService (tổng thu/chi, số dư ví)
2. Frontend: DashboardPage với charts (Chart.js)

---

## Quyết định và Cân nhắc
- Prototype đã xác nhận UI/UX; tech stack đã cố định (Bun/Hono/SQLite/React)
- Tất cả amounts lưu integer cents; VND user nhập "150.000" → lưu 15000000
- Drizzle SQLite không có `.returning()` sau INSERT → query lại bằng ID
