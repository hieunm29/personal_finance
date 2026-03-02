# Ngữ cảnh Hoạt động (Active Context)

## Trọng tâm Công việc Hiện tại
**Giai đoạn:** Phase 1 MVP — Category Management (US-CAT-01→07) vừa hoàn thành.
**Tiếp theo:** Module 4 Dashboard hoặc US-TXN-08 Recurring.

---

## Các Thay đổi Gần đây (2026-03-02)

### Category Management hoàn thành (US-CAT-01→07)

**Backend** (`apps/server/src/`):
- `services/categoryService.ts` — getCategories(showHidden), getCategoryGroups, createCategory (unique check), updateCategory, toggleVisibility, deleteCategory (re-assign), createCategoryGroup, updateCategoryGroup
- `routes/categories.ts` — GET(+showHidden) / POST / PUT/:id / PATCH/:id/visibility / DELETE/:id
- `routes/category-groups.ts` — GET / POST / PUT/:id (mới)
- `middleware/errorHandler.ts` — xử lý status 400/404/409 từ service throws

**Frontend** (`apps/web/src/`):
- `hooks/useCategories.ts` — thêm useCreateCategory, useUpdateCategory, useToggleCategoryVisibility, useDeleteCategory, showHidden param
- `hooks/useCategoryGroups.ts` — useCategoryGroups, useCreateCategoryGroup, useUpdateCategoryGroup (mới)
- `pages/CategoriesPage.tsx` — full CRUD: 2 tabs, grouped view (kể cả nhóm rỗng), modals, badge Ẩn
- `components/category/CategoryForm.tsx` — create + edit mode (2 form riêng tránh RHF type conflict)
- `components/category/CategoryGroupForm.tsx` — create + edit mode
- `components/category/DeleteCategoryDialog.tsx` — replacement select khi có transactions

**Quyết định kỹ thuật quan trọng:**
- CategoryForm: dùng 2 component riêng (CreateForm + EditForm) thay vì shared form — tránh TypeScript type conflict với `register` của react-hook-form
- Empty groups: dùng `useCategoryGroups(activeTab)` để seed Map trước khi fill categories, hiển thị nhóm 0 danh mục
- Delete với replacement: frontend fetch count qua `GET /transactions?categoryId=X&limit=1` (meta.total), không cần endpoint riêng
- Error handler: service throw `Object.assign(new Error(msg), { status: N })`, handler check `(err as any).status`

---

## Các Bước Tiếp theo

### Option A — Module 4: Dashboard
1. Backend: dashboardService (tổng thu/chi tháng, số dư ví)
2. Frontend: DashboardPage với summary cards + charts

### Option B — Phase 2 Transaction
1. **US-TXN-08:** Recurring Templates (recurringService, RecurringPage)
2. **US-TXN-09:** Export CSV

---

## Quyết định và Cân nhắc
- Prototype đã xác nhận UI/UX; tech stack đã cố định (Bun/Hono/SQLite/React)
- Tất cả amounts lưu integer cents; VND user nhập "150.000" → lưu 15000000
- Drizzle SQLite không có `.returning()` sau INSERT → query lại bằng ID
