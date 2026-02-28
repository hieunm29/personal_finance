# Ngữ cảnh Kỹ thuật (Tech Context)

## Công nghệ Hiện tại (Prototype)

| Thành phần | Công nghệ | Ghi chú |
|:---|:---|:---|
| UI Prototype | HTML5 + CSS3 + Vanilla JS | Self-contained, không cần server |
| Biểu đồ | Chart.js 4.4.0 (CDN) | Bar, Line, Doughnut, Area |
| Styling | CSS Custom Properties (Variables) | Design system, dark mode |
| Responsive | CSS Media Queries | Desktop sidebar + Mobile bottom nav |

## Công nghệ Dự kiến (Ứng dụng thực — chưa quyết định chính thức)

### Frontend
- Framework: **Chưa chọn** (React / Vue / Svelte)
- Charts: **Chart.js** hoặc **Recharts** (nếu dùng React)
- Styling: TailwindCSS hoặc CSS Modules

### Backend
- Runtime: **Chưa chọn** (Node.js / Go / Python)
- Framework: Express / Fastify / FastAPI / Gin
- Auth: JWT (access 30 phút) + Refresh token (7 ngày)
- Password: BCrypt

### Database
- **Chưa chọn** (PostgreSQL / SQLite / PlanetScale)

### Deployment
- Self-hosted hoặc cloud (chưa quyết định)

## Thiết lập Phát triển
- OS: macOS (darwin 25.2.0)
- Package manager: **Bun** (đã cài tại `~/.bun/bin/bun`)
- Editor: Neovim + LazyVim
- LSP đã cài: `html`, `cssls`, `ts_ls` (typescript-language-server), `eslint`, `emmet_language_server`
- Formatter: Prettier (cho HTML, CSS, JS, TS, JSON)

## Các Ràng buộc Kỹ thuật
- Ứng dụng phải hỗ trợ **self-hosted** (không khóa dữ liệu cloud).
- Ngôn ngữ giao diện: **Tiếng Việt**.
- Đơn vị tiền tệ mặc định: **VND** (định dạng: `1.000.000 đ`).
- Responsive: hoạt động tốt trên desktop và mobile browser.
- Dữ liệu thuộc về người dùng — phải hỗ trợ xuất/nhập JSON.

## Design System (từ Prototype)
```css
--primary:       #4f46e5  /* Indigo */
--success:       #16a34a  /* Green  — Thu nhập */
--danger:        #dc2626  /* Red    — Chi tiêu  */
--warning:       #d97706  /* Amber  — Cảnh báo  */
--radius:        12px
--radius-sm:     8px
```
- Font: `'Segoe UI', system-ui, -apple-system, sans-serif`
- Dark mode: CSS `[data-theme="dark"]` với CSS Variables
