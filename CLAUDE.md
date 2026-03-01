# CLAUDE.md — Quy tắc dự án

## Quy tắc quan trọng

- **KHÔNG tự ý triển khai code** trừ khi người dùng yêu cầu rõ ràng hoặc cho phép.
- Khi nhận yêu cầu mơ hồ, hỏi lại để xác nhận phạm vi trước khi làm.
- Chỉ làm đúng những gì được yêu cầu — không làm thêm, không mở rộng.

## Tech Stack
- **Runtime:** Bun
- **Frontend:** React 19 + Vite + TailwindCSS 4
- **Backend:** Hono 4 (Bun native server)
- **Database:** SQLite (via bun:sqlite) + Drizzle ORM
- **Auth:** better-auth (self-hosted, cookie-based sessions)
- **Deploy:** Docker Compose

## Lệnh Dev
```bash
bun run dev:web     # → http://localhost:5173
bun run dev:server  # → http://localhost:3000/api/health
bun run db:generate # Generate Drizzle migrations
bun run db:migrate  # Apply migrations
bun run db:seed     # Seed test data
```
