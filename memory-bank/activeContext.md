# Ngữ cảnh Hoạt động (Active Context)

## Trọng tâm Công việc Hiện tại
**Giai đoạn:** Phase 1 MVP — Budget Planner (US-BUD-01→07) vừa hoàn thành + Dashboard budget integration bug fix.
**Tiếp theo:** Đợt 2 theo `doc/10.dot2_plan.md` — Bước 1 (PWA) xong, chưa commit; tiếp theo Bước 2 (tin thoại Zalo).

---

## Các Thay đổi Gần đây (2026-11-27) — Đợt 2, Bước 1: PWA (chưa commit)
- **Kế hoạch Đợt 2:** `doc/10.dot2_plan.md` (PWA → giọng nói → ảnh hóa đơn 7 ngày → thông báo Zalo → sổ chung). `zalo:send-test` đã đạt: bot gửi tin chủ động được.
- **Đã làm:** `apps/web/public/` (manifest + icon), meta iOS trong `index.html`, đệm safe-area chỉ cộng thêm (`max(cũ, env(...))`), cache tĩnh production qua `middleware/staticCache.ts` (`mountWebDist`), phiên better-auth 30 ngày.
- **Quyết định:**
  - Không dùng service worker; tốc độ mở nhờ cache HTTP (`/assets/*` immutable, `index.html`/manifest `no-cache`). File thiếu dưới `/assets/<x>` trả 404, nhưng `/assets` là trang "Tài sản" của SPA nên vẫn rơi về fallback.
  - Middleware `/api/*` gọi `getSession` với `disableRefresh: true`: chỉ `/api/auth/get-session` gia hạn phiên, vì chỉ ở đó cookie được gửi lại trình duyệt.
  - iOS: thêm `maximum-scale=1` bằng script chỉ trên iPhone/iPad để chặn tự phóng to ô nhập (ô nhập 13–14px); không đổi cỡ chữ.
  - Đệm thanh home cho form, hộp xác nhận xóa, khung chi tiết giao dịch; đệm hai bên khi xoay ngang (≤ 860px). Tất cả không đổi gì khi inset = 0 (đã so ảnh chụp trước/sau).
- **Chưa kiểm tra:** cài thật trên iPhone/Android.

---

## Các Thay đổi Gần đây (2026-11-21) — Đợt 1 "dùng được mỗi ngày" (chưa commit)
- **Bối cảnh:** đánh giá cho thấy phần ghi chép/phân tích đã đủ, thiếu vòng thói quen hằng ngày. Đợt 1: bot chạy 24/7 + sao lưu, "hôm nay được tiêu bao nhiêu", bot đọc ảnh, nhắc chủ động qua Zalo.
- **Đã làm:** ảnh bill (đề xuất rồi mới ghi), `getSafeToSpend` + badge Dashboard, hạ tầng deploy (entrypoint, Caddy, compose), scheduler `jobs/` + sao lưu R2, script `zalo:send-test`. Chi tiết và trạng thái từng việc: `progress.md`.
- **Quyết định:**
  - Lượt có ảnh bỏ hẳn tool ghi khỏi request (an toàn bằng cấu trúc, không bằng prompt); guard có chế độ `proposalOnly`.
  - `getSafeToSpend` đếm hóa đơn định kỳ **từ đầu tháng**, chỉ lần chưa sinh giao dịch (> `lastGeneratedDate`) → không trừ hai lần; số ngày còn lại tính cả hôm nay.
  - Sao lưu chỉ bật ở production; upload R2 lỗi thì lần sau chỉ upload lại bản đã có, không chụp lại.
  - Thông báo chủ động (Bước 4) **tạm dừng** chờ kết quả `zalo:send-test` vì tài liệu Zalo không nói gì về giới hạn gửi chủ động.
  - Migration job_runs là `0006` (kế hoạch ban đầu dành 0006 cho thông báo → thông báo sẽ là 0007).
- **Còn dang dở:** chưa deploy thật; chưa thử ảnh thật từ Zalo; chưa thử upload R2 thật; Bước 4 (thông báo chủ động) chờ kết quả `zalo:send-test`.

## Các Thay đổi Gần đây (2026-11-20) — Chuyển khoản & tiền mặt có số dư
- Chuyển tiền giữa tài khoản (rút ATM, nộp tiền, chuyển ngân hàng): `POST /api/transactions/transfer`, nút "⇄ Chuyển khoản" trong form, tool bot `create_transfer` (hoàn tác được). Thiết kế: `doc/8.transfer_design.md`.
- Ví (`wallets`, không có số dư) đã được migration 0005 chuyển thành tài sản `cash`; tài khoản giao dịch giờ là tài sản cash/bank (`asset-<uuid>`).
- Liên kết Zalo trên trang Cài đặt; bot chạy qua cloudflared quick tunnel (URL đổi mỗi lần khởi động lại → sửa PUBLIC_BASE_URL + `bun run zalo:webhook`).

## Các Thay đổi (2026-11-20) — Trí nhớ dài hạn cho AI
- Bảng `ai_user_facts` (migration 0004) + tool `remember_fact` / `forget_fact`; danh sách được chèn vào system prompt mỗi lượt. `/reset` chỉ xóa lịch sử chat, không xóa điều đã nhớ.
- Guard kiểm tra thêm câu "Đã ghi nhớ"/"Đã quên"; "Đã ghi nhớ" không còn bị coi là ghi giao dịch.

## Các Thay đổi (2026-11-19) — AI Assistant qua Zalo Bot
- Dựng khung trợ lý AI (Claude + Zalo Bot Platform). Chi tiết: `doc/7.ai_assistant_architecture.md`.
- Quyết định: Claude Messages API + Tool Runner tự host (không dùng Managed Agents); ghi giao dịch luôn + lệnh "hoàn tác"; liên kết tài khoản bằng mã `/link`.
- Bước tiếp theo: chạy thử `bun run ai:chat` với API key thật; tạo bot Zalo + tunnel; thiết kế UI "Liên kết Zalo" ở trang Cài đặt (cần duyệt layout); xây bộ eval câu chat mẫu.

## Các Thay đổi Trước (2026-03-04)

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
