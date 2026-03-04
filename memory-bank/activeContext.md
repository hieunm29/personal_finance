# Ngữ cảnh Hoạt động (Active Context)

## Trọng tâm Công việc Hiện tại
**Giai đoạn:** Phase 1 MVP — Budget Planner (US-BUD-01→07) vừa hoàn thành + Dashboard budget integration bug fix.
**Tiếp theo:** US-TXN-08 Recurring hoặc Phase 2 features.

---

## Các Thay đổi Gần đây (2026-03-04)

### Budget Planner hoàn thành (US-BUD-01→07)

**Shared** (`packages/shared/src/`):
- `schemas/index.ts` — thêm createBudgetSchema, updateBudgetSchema, categoryBudgetItemSchema, copyPreviousBudgetSchema, budgetFilterSchema
- `types/index.ts` — thêm Budget, CategoryBudget, CategoryBudgetWithProgress, BudgetWithProgress, BudgetHistory
- `constants/index.ts` — thêm QUERY_KEYS.budgets, budgetProgress, budgetHistory

**Backend** (`apps/server/src/`):
- `services/budgetService.ts` — get, upsert, update, delete, copyPrevious, getProgress, getHistory
- `routes/budget.ts` — GET/?month, POST/, PUT/:id, DELETE/:id, POST/copy-previous, GET/progress, GET/history
- `index.ts` — mount `/api/budgets` route
- `services/dashboardService.ts` — **BUG FIX:** `budgetProgress: null` cứng → import getBudgetProgress từ budgetService, map sang BudgetProgressItem[]

**Frontend** (`apps/web/src/`):
- `hooks/useBudget.ts` — useBudget, useBudgetProgress, useBudgetHistory, useUpsertBudget, useUpdateBudget, useDeleteBudget, useCopyPreviousBudget
- `pages/BudgetPage.tsx` — month selector, empty state, summary cards, CategoryBudgetList, BudgetChart, BudgetHistoryList
- `components/budget/BudgetFormModal.tsx` — create/edit mode, category inputs, copy-from-prev checkbox
- `components/budget/CategoryBudgetList.tsx` — progress bars (green/amber/red by threshold)
- `components/budget/BudgetChart.tsx` — Chart.js horizontal bar (indexed axis Y), max-height 600px
- `components/budget/BudgetHistoryList.tsx` — table với hover CSS, click row → onSelectMonth
- `utils/date.ts` — getPreviousMonth utility
- `hooks/useTransactions.ts` — invalidate `['budgets']` prefix sau transaction mutation
- `components/dashboard/BudgetProgressCard.tsx` — warning badges (amber >=80%, red >=100%)
- `components/layout/AppLayout.tsx` — thêm nav "Ngân sách" 🎯 → /budget
- `App.tsx` — thêm route /budget → BudgetPage
- `index.css` — .budget-history-row:hover CSS rule

**Quyết định kỹ thuật quan trọng:**
- Route order: `/copy-previous`, `/progress`, `/history` mount TRƯỚC `/:id` trong Hono để tránh param match nhầm
- Month format: `YYYY-MM` (text), validate bằng zod `.regex(/^\d{4}-\d{2}$/)`
- SQLite date filter: `date LIKE 'YYYY-MM-%'` để lọc transactions trong tháng
- CategoryBudget upsert: DELETE + re-INSERT trong SQLite transaction (không dùng ON CONFLICT)
- BudgetChart: bar "Thực tế" màu green khi spent <= limitAmount, red khi vượt
- CategoryBudgetList: chỉ hiển thị categories có `limitAmount > 0`
- CategoryBudgetList: hiển thị tên category chỉ (không icon prefix)

---

## Các Bước Tiếp theo

### Option A — Phase 2 Transaction
1. **US-TXN-08:** Recurring Templates (recurringService, RecurringPage)
2. **US-TXN-09:** Xuất CSV

### Option B — Improvements
1. Dashboard chart bổ sung (trend by month)
2. Export report

---

## Quyết định và Cân nhắc
- Prototype đã xác nhận UI/UX; tech stack đã cố định (Bun/Hono/SQLite/React)
- Tất cả amounts lưu integer cents; VND user nhập "150.000" → lưu 15000000
- Drizzle SQLite không có `.returning()` sau INSERT → query lại bằng ID
