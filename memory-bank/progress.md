# Tiến độ (Progress)

## Trạng thái Hiện tại
**Giai đoạn:** Môi trường dev sẵn sàng — Chuẩn bị implement Phase 1 (MVP)
**Cập nhật:** 2026-02-28

---

## ✅ Đã Hoàn thành

### Documentation
- [x] `doc/0.overview.md` — Yêu cầu tổng quan
- [x] `doc/1.product.md` — Product spec đầy đủ (7 modules, 3 phases)
- [x] `doc/2a–2h.userstories_*.md` — 8 file user stories chi tiết
- [x] `doc/3.techbase.md` — Tech stack chính thức
- [x] `doc/3b.tech_structure.md` — Kiến trúc kỹ thuật chi tiết (data flow, patterns, folder structure)
- [x] `doc/4.database_prepare.md` — SQL schema + test data đầy đủ

### Database (Supabase — project: supabase-red-canvas)
- [x] 6 enums tạo thành công
- [x] 10 bảng tạo thành công (đúng thứ tự FK dependencies)
- [x] 14 indexes tạo thành công
- [x] Test user: `test@example.com` / `Test123456!` (UUID: `aaaaaaaa-0000-0000-0000-000000000001`)
- [x] Dữ liệu test: 1 profile, 8 category groups, 25 categories, 3 wallets, 24 transactions, 1 budget, 6 category budgets, 10 assets, 6 asset history records

### Monorepo Scaffold
- [x] Root: `package.json` (Bun workspaces), `tsconfig.json`, `bunfig.toml`, `vercel.json`
- [x] `.env` — điền sẵn SUPABASE_URL + ANON_KEY (còn thiếu SERVICE_ROLE_KEY và DATABASE_URL password)
- [x] `CLAUDE.md` — project rules
- [x] `packages/shared/` — Zod schemas, TypeScript types, constants dùng chung FE/BE
- [x] `apps/web/` — React 19 + Vite 6 + TailwindCSS 4 (chạy được trên :5173)
- [x] `apps/server/` — Hono 4 + Drizzle ORM (chạy được trên :3000)
- [x] `api/index.ts` — Vercel serverless entry
- [x] `bun install` — 266 packages installed

### Prototype (UI/UX tham khảo)
- [x] `prototype/` — Self-contained HTML prototype, 7 trang đầy đủ

---

## 🔲 Còn Lại

### Env vars cần bổ sung
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Dashboard > Settings > API > service_role
- [ ] `DATABASE_URL` — thay `[PASSWORD]` bằng DB password thực

### Phase 1 — MVP
- [ ] Auth flow: đăng nhập / đăng ký (Supabase Auth + frontend)
- [ ] Dashboard: tổng quan thu/chi tháng hiện tại
- [ ] Transactions: CRUD, lọc, phân trang
- [ ] Categories: xem danh mục, quản lý cơ bản

### Phase 2
- [ ] Budget Planner
- [ ] Asset Tracker + Net Worth
- [ ] Báo cáo đầy đủ + Giao dịch định kỳ

### Phase 3
- [ ] Settings nâng cao
- [ ] Responsive mobile
- [ ] Tối ưu hiệu năng

---

## Các Vấn đề Đã biết
- Bun `--watch` + Bun native server gây lỗi `EADDRINUSE` khi reload — chạy server 1 lần bình thường không bị
- `hono/vercel` trong `api/index.ts` chưa resolve type (chỉ cần khi deploy Vercel, không ảnh hưởng dev)
- Port conflict khi có stale process: dùng `lsof -ti:5173,3000 | xargs kill -9` để dọn
