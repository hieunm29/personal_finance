# Ngữ cảnh Hoạt động (Active Context)

## Trọng tâm Công việc Hiện tại
- Đã hoàn thành giai đoạn **Documentation & Prototype**.
- Bước tiếp theo: chọn tech stack chính thức và bắt đầu triển khai ứng dụng thực.

## Các Thay đổi Gần đây

### Giai đoạn 1 — Documentation (2026-02-27)
- Tạo `doc/0.overview.md` — yêu cầu tổng quan ban đầu.
- Tạo `doc/1.product.md` — tổng quan sản phẩm đầy đủ (7 modules, 3 phases, design principles).
- Tạo 8 file user stories: authentication, transaction, category, dashboard, budget, asset, report, settings.
- Thiết lập Memory Bank (6 file) và agent rules (`.agent/rules/`).

### Giai đoạn 2 — Prototype (2026-02-28)
- Tạo `prototype/index.html` — SPA prototype 7 trang (Dashboard, Giao dịch, Danh mục, Ngân sách, Tài sản, Báo cáo, Cài đặt).
- Tạo `prototype/login.html` — Auth: Đăng nhập / Đăng ký / Quên mật khẩu.
- Tạo `prototype/css/style.css` — Design system hoàn chỉnh với dark mode.
- Tạo `prototype/js/data.js` — Sample data.
- Tạo `prototype/js/charts.js` — Chart.js (bar, line, doughnut, area).
- Tạo `prototype/js/ui.js` — UI rendering functions.
- Tạo `prototype/js/app.js` — Navigation, modals, theme.

## Các Bước Tiếp theo
1. **Chọn tech stack** cho ứng dụng thực (frontend framework, backend, database).
2. **Thiết kế database schema** (transactions, categories, budgets, assets, wallets, users).
3. **Triển khai Phase 1 (MVP)**:
   - Module 1: Authentication (JWT + BCrypt).
   - Module 2: Transaction Engine (CRUD).
   - Module 3: Category Management.
   - Module 6: Dashboard cơ bản.

## Quyết định và Cân nhắc
- Prototype đã xác nhận UI/UX, design system, và luồng người dùng.
- Tech stack chưa được quyết định chính thức — prototype dùng vanilla HTML/CSS/JS.
- Kiến trúc ứng dụng thực cần được thiết kế trước khi code.
