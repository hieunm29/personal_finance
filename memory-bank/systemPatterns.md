# Mẫu Hệ thống (System Patterns)

## Kiến trúc Hệ thống (Dự kiến)

```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND (SPA)                    │
│  Dashboard · Transactions · Budget · Assets · ...   │
└───────────────────┬─────────────────────────────────┘
                    │ REST API / JSON
┌───────────────────▼─────────────────────────────────┐
│                    BACKEND                           │
│   Auth · Transaction Engine · Budget · Asset ...    │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│                   DATABASE                           │
│  users · wallets · categories · transactions        │
│  budgets · assets · asset_snapshots                 │
└─────────────────────────────────────────────────────┘
```

## Các Mẫu Thiết kế (từ Prototype)

### Navigation Pattern — SPA
- **Desktop**: Sidebar cố định bên trái (240px), content bên phải.
- **Mobile**: Bottom navigation bar (5 tab), sidebar ẩn đi.
- Page switching: show/hide `<section class="page">` bằng JS — không reload.

### Data Layer Pattern
- Dữ liệu mẫu tập trung trong `js/data.js` (CATEGORIES, TRANSACTIONS, BUDGETS, ASSETS, WALLETS).
- Format tiền VND: `new Intl.NumberFormat('vi-VN').format(n) + ' đ'`.
- Khi chuyển sang app thực: thay `data.js` bằng API calls.

### Chart Pattern
- Mỗi biểu đồ có một `<canvas id="...">` riêng.
- `safeChart(id, config)` — destroy chart cũ trước khi tạo mới (tránh memory leak).
- Charts khởi tạo lazy: chỉ render khi navigate tới trang đó (`setTimeout(..., 50)`).

### Theme Pattern
- Dark mode dùng CSS `[data-theme="dark"]` + CSS Custom Properties.
- Toggle bằng `document.documentElement.setAttribute('data-theme', ...)`.
- Đồng bộ giữa topbar button và settings checkbox.

### Modal Pattern
- Mỗi modal là `<div class="modal-overlay" id="...">`.
- `openModal(id)` / `closeModal(id)` thêm/bớt class `.open`.
- Đóng modal khi click overlay hoặc phím Escape.

## Cấu trúc Dữ liệu Chính (Domain Model)

### Transaction
```js
{
  id, type: 'income'|'expense',
  cat, icon, color,
  amount,       // VND, số dương
  note,
  date,         // 'YYYY-MM-DD'
  month,        // number
  wallet_id
}
```

### Category (2 cấp)
```js
// Nhóm → Danh mục con
CATEGORIES.expense['Thiết yếu'] = [
  { id, name, icon, color }
]
```

### Budget
```js
{ cat, icon, color, limit, spent }
// Cảnh báo tại 80% và 100%
```

### Asset
```js
{
  name, icon, bg, value,
  note,
  isDebt?: boolean  // true → trừ vào Net Worth
}
// Net Worth = Σ(tài sản) - Σ(nợ)
```

### Wallet
```js
{ name, icon, bg, balance, isDefault }
// Chuyển tiền nội bộ không tính vào thu/chi
```

## Mối Quan hệ giữa các Thành phần

```
User ──1:N──▶ Wallet
User ──1:N──▶ Category (custom, kế thừa preset)
User ──1:N──▶ Transaction ──M:1──▶ Category
                          └──M:1──▶ Wallet
User ──1:N──▶ Budget ──M:1──▶ Category (expense only)
User ──1:N──▶ Asset
```

## File Structure (Prototype)

```
prototype/
├── index.html          ← SPA entry point
├── login.html          ← Auth (login / register / forgot)
├── css/
│   └── style.css       ← Design system + components
└── js/
    ├── data.js         ← Seed data (thay bằng API sau)
    ├── charts.js       ← Chart.js initializers
    ├── ui.js           ← DOM rendering functions
    └── app.js          ← Navigation, modals, init
```
