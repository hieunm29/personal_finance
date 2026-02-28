# Tiến độ (Progress)

## Trạng thái Hiện tại
**Giai đoạn:** Prototype hoàn thành — Chuẩn bị triển khai ứng dụng thực

---

## ✅ Đã Hoàn thành

### Documentation
- [x] `doc/0.overview.md` — Yêu cầu tổng quan.
- [x] `doc/1.product.md` — Product spec đầy đủ (7 modules, 3 phases).
- [x] `doc/2a–2h.userstories_*.md` — 8 file user stories chi tiết.
- [x] Memory Bank khởi tạo (6 file cốt lõi).
- [x] Agent rules thiết lập (`.agent/rules/`).

### Prototype (UI/UX)
- [x] `prototype/login.html` — Auth: đăng nhập, đăng ký, quên mật khẩu, validation.
- [x] `prototype/index.html` — SPA 7 trang với navigation đầy đủ.
- [x] `prototype/css/style.css` — Design system: colors, typography, components, responsive, dark mode.
- [x] `prototype/js/data.js` — 24 giao dịch mẫu, danh mục, ngân sách, tài sản, ví.
- [x] `prototype/js/charts.js` — 6 loại biểu đồ (Chart.js 4).
- [x] `prototype/js/ui.js` — Render: transactions, categories, budget, assets, settings.
- [x] `prototype/js/app.js` — Navigation, modal, dark mode, form logic.

---

## 🔲 Còn Lại Cần Xây dựng

### Quyết định kỹ thuật
- [ ] Chọn frontend framework (React / Vue / Svelte / vanilla).
- [ ] Chọn backend (Node.js/Express, Go, Python/FastAPI, ...).
- [ ] Chọn database (PostgreSQL, SQLite, MongoDB, ...).
- [ ] Quyết định self-hosted vs cloud.

### Backend
- [ ] Database schema (users, wallets, categories, transactions, budgets, assets).
- [ ] Auth API: đăng ký, đăng nhập, JWT, refresh token.
- [ ] Transaction API: CRUD, lọc, phân trang.
- [ ] Category API: CRUD, cấu trúc 2 cấp.
- [ ] Budget API: đặt ngân sách, theo dõi chi tiêu.
- [ ] Asset API: CRUD tài sản, tính Net Worth.
- [ ] Report API: tổng hợp theo thời gian.
- [ ] Settings API: quản lý ví, preferences.

### Frontend (App thực)
- [ ] Tích hợp với backend API.
- [ ] State management.
- [ ] Form validation nâng cao.
- [ ] Giao dịch định kỳ (recurring transactions).
- [ ] Xuất CSV/Excel.
- [ ] PWA / offline support.

---

## Các Vấn đề Đã biết
- Chưa có vấn đề kỹ thuật nào — ứng dụng thực chưa được triển khai.
- Prototype là self-contained HTML, không kết nối backend.
