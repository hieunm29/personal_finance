# Hướng dẫn Deploy lên Oracle Cloud Free Tier VPS

> Triển khai toàn bộ ứng dụng Personal Finance (Bun + Hono + React + SQLite) lên **1 con VPS Oracle Always Free** chạy liên tục 24/7, chi phí **$0/tháng**.
>
> Kiến trúc deploy: **1 container Docker** — server Hono/Bun phục vụ cả API (`/api/*`) lẫn frontend tĩnh (`apps/web/dist`) trên cùng cổng 3000. SQLite lưu trong Docker volume nên dữ liệu bền qua các lần deploy.

---

## Mục lục
1. [Chuẩn bị tài khoản Oracle](#1-chuẩn-bị-tài-khoản-oracle)
2. [Tạo VM (Instance)](#2-tạo-vm-instance)
3. [Mở cổng mạng (Firewall)](#3-mở-cổng-mạng-firewall)
4. [Kết nối SSH & cài Docker](#4-kết-nối-ssh--cài-docker)
5. [Sửa code trước khi deploy (3 điểm bắt buộc)](#5-sửa-code-trước-khi-deploy-3-điểm-bắt-buộc)
6. [Đưa mã nguồn lên VPS](#6-đưa-mã-nguồn-lên-vps)
7. [Cấu hình biến môi trường production](#7-cấu-hình-biến-môi-trường-production)
8. [Build & chạy](#8-build--chạy)
9. [Cài HTTPS với Caddy (khuyến nghị)](#9-cài-https-với-caddy-khuyến-nghị)
10. [Vận hành: update, backup, log](#10-vận-hành-update-backup-log)

---

## 1. Chuẩn bị tài khoản Oracle

1. Đăng ký tại https://www.oracle.com/cloud/free/ (cần thẻ tín dụng/ghi nợ để xác minh — **không bị trừ tiền** với tài nguyên Always Free).
2. Chọn **Home Region** gần bạn (ví dụ `Singapore` hoặc `Japan (Tokyo/Osaka)` cho user Việt Nam). ⚠️ **Region không đổi được sau này**.

**Tài nguyên Always Free bạn sẽ dùng:**
- **Ampere A1 (ARM)**: tối đa 4 OCPU + 24GB RAM (miễn phí vĩnh viễn). App này chỉ cần ~1 core/2GB là dư.
- 200GB block storage.
- 10TB egress/tháng.

---

## 2. Tạo VM (Instance)

1. Console Oracle → **Compute → Instances → Create Instance**.
2. **Name**: `personal-finance`.
3. **Image and shape**:
   - Image: **Ubuntu 22.04** (hoặc 24.04).
   - Shape: bấm **Change Shape → Ampere → VM.Standard.A1.Flex**.
   - Cấu hình: **1 OCPU, 6GB RAM** (đủ dùng, vẫn trong hạn free 4 OCPU/24GB).
4. **Networking**: giữ mặc định (tạo VCN mới). Đảm bảo **"Assign a public IPv4 address" = Yes**.
5. **SSH keys**: chọn **Generate a key pair** → **tải cả private key** về máy (giữ kỹ, dùng để SSH).
6. Bấm **Create**. Chờ ~1 phút tới khi trạng thái **RUNNING**, ghi lại **Public IP address**.

> 💡 Nếu báo *"Out of capacity"* cho A1 ở region đó, thử lại vào giờ khác hoặc dùng tạm shape AMD `VM.Standard.E2.1.Micro` (1GB RAM — hơi chật nhưng chạy được).

---

## 3. Mở cổng mạng (Firewall)

Oracle chặn cổng ở **2 tầng**, phải mở **cả hai**.

### 3a. Security List (tầng Oracle Cloud)
1. Instance → click **Virtual Cloud Network** đang dùng → **Security Lists** → **Default Security List**.
2. **Add Ingress Rules**:
   | Source CIDR | Protocol | Dest. Port |
   |---|---|---|
   | `0.0.0.0/0` | TCP | `80` |
   | `0.0.0.0/0` | TCP | `443` |

   (Cổng 22 SSH đã mở sẵn. Tạm thời có thể mở `3000` để test trực tiếp trước khi dựng Caddy, sau đó nên đóng lại.)

### 3b. iptables (tầng trong máy Ubuntu)
Ubuntu trên Oracle mặc định có iptables chặn. Sau khi SSH vào (bước 4), chạy:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 4. Kết nối SSH & cài Docker

Trên máy của bạn (Mac):
```bash
chmod 400 ~/Downloads/ssh-key-*.key           # private key vừa tải
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<PUBLIC_IP>
```

Sau khi vào VPS, cài Docker + Compose plugin:
```bash
# Cập nhật & cài Docker theo script chính thức
curl -fsSL https://get.docker.com | sudo sh

# Cho user ubuntu chạy docker không cần sudo
sudo usermod -aG docker ubuntu
newgrp docker          # hoặc thoát ra & SSH lại

# Kiểm tra
docker --version
docker compose version
```

---

## 5. Sửa code trước khi deploy (3 điểm BẮT BUỘC)

Đây là 3 chỗ đã phát hiện khi rà dự án. **Làm ở máy local, commit, rồi mới đưa lên VPS.**

### 5a. Tự động chạy migration khi khởi động
Hiện `Dockerfile` chỉ start server, **không chạy migrate** → volume trống lần đầu sẽ không có bảng. Tạo entrypoint:

**Tạo file `docker-entrypoint.sh`** (thư mục gốc):
```bash
#!/bin/sh
set -e
echo "Running database migrations..."
bun run --filter './apps/server' db:migrate
echo "Starting server..."
exec bun run apps/server/src/index.ts
```

**Sửa cuối `Dockerfile`** — thay dòng `CMD`:
```dockerfile
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
```

### 5b. Sửa `VITE_API_URL` để dùng same-origin
Frontend `apiClient.ts` và `auth-client.ts` mặc định gọi `http://localhost:3000` nếu không set biến. Vì production server phục vụ frontend cùng origin, ta build với URL công khai. Có 2 cách:

- **Cách khuyến nghị (đường dẫn tương đối):** đổi mặc định thành chuỗi rỗng để gọi same-origin:
  - `apps/web/src/services/apiClient.ts`: `const API_BASE = import.meta.env.VITE_API_URL ?? ''`
  - `apps/web/src/lib/auth-client.ts`: `baseURL: import.meta.env.VITE_API_URL ?? ''`
  - → khi đó frontend gọi `/api/...` đúng domain đang mở, không cần biết trước domain.
- **Hoặc** giữ nguyên code, và luôn set `VITE_API_URL=https://your-domain` lúc build (xem bước 7).

### 5c. Env production trỏ đúng domain/IP
`BETTER_AUTH_URL` và `FRONTEND_URL` phải là domain/IP thật (không còn `localhost`) — xử lý ở bước 7.

> Sau khi sửa xong: `git add -A && git commit -m "chore: production deploy config"`.

---

## 6. Đưa mã nguồn lên VPS

**Cách A — qua Git (khuyến nghị):**
```bash
# Trên VPS
sudo apt-get update && sudo apt-get install -y git
git clone <URL_REPO_CỦA_BẠN> personal-finance
cd personal-finance
```

**Cách B — copy trực tiếp từ máy local** (nếu chưa có remote repo):
```bash
# Chạy trên máy Mac, ở thư mục dự án
rsync -av --exclude node_modules --exclude .git \
  -e "ssh -i ~/Downloads/ssh-key-*.key" \
  ./ ubuntu@<PUBLIC_IP>:~/personal-finance/
```

---

## 7. Cấu hình biến môi trường production

Trên VPS, trong thư mục `personal-finance`, tạo file `.env`:
```bash
cat > .env <<'EOF'
# Sinh secret ngẫu nhiên >= 32 ký tự
BETTER_AUTH_SECRET=THAY_BANG_CHUOI_NGAU_NHIEN_32_KY_TU
EOF
```
Sinh secret nhanh:
```bash
echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)" > .env
```

**Sửa `docker-compose.yml`** cho production (đổi `localhost` → domain/IP thật). Ví dụ dùng domain `finance.example.com`:
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:./data/app.db
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - BETTER_AUTH_URL=https://finance.example.com
      - FRONTEND_URL=https://finance.example.com
      - NODE_ENV=production
      - PORT=3000
    volumes:
      - db-data:/app/data
    restart: unless-stopped        # tự chạy lại khi VM reboot
volumes:
  db-data:
```

> Nếu bạn chọn 5b cách "đường dẫn tương đối" thì **không cần** set `VITE_API_URL`. Nếu giữ code cũ, thêm build arg `VITE_API_URL` và truyền vào lúc build.

> Chưa có domain? Tạm dùng `http://<PUBLIC_IP>:3000` cho cả 2 URL và mở cổng 3000 ở bước 3 để test. Nhưng auth cookie nên chạy qua HTTPS (bước 9).

---

## 8. Build & chạy

```bash
# Trong thư mục personal-finance trên VPS
docker compose up -d --build
```
Lần build đầu mất vài phút (cài deps + build frontend). Kiểm tra:
```bash
docker compose ps               # container phải ở trạng thái Up
docker compose logs -f app      # xem log, phải thấy "Running database migrations" rồi server start
curl http://localhost:3000/api/health   # {"status":"ok",...}
```
Nếu đã mở cổng 3000: mở trình duyệt `http://<PUBLIC_IP>:3000`.

---

## 9. Cài HTTPS với Caddy (khuyến nghị)

Caddy tự động xin chứng chỉ Let's Encrypt, đơn giản hơn nginx. **Cần 1 domain trỏ A record về Public IP.**

Tạo `Caddyfile` trong thư mục dự án:
```
finance.example.com {
    reverse_proxy app:3000
}
```

Thêm service Caddy vào `docker-compose.yml`:
```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - app

volumes:
  db-data:
  caddy-data:
  caddy-config:
```
Và **bỏ** dòng `ports: - "3000:3000"` của service `app` (không expose trực tiếp nữa, chỉ Caddy ra ngoài).

Chạy lại:
```bash
docker compose up -d --build
```
Truy cập `https://finance.example.com` — Caddy tự cấp SSL. Sau bước này nên **đóng cổng 3000** trong Security List.

---

## 10. Vận hành: update, backup, log

**Cập nhật khi có code mới:**
```bash
cd ~/personal-finance
git pull                        # hoặc rsync lại
docker compose up -d --build    # build lại & restart, volume DB giữ nguyên
```

**Backup database (SQLite trong volume):**
```bash
# Copy file DB ra ngoài
docker compose cp app:/app/data/app.db ./backup-app-$(date +%F).db
```
Nên đặt cron `crontab -e` để backup định kỳ, ví dụ hằng ngày 2h sáng.

**Xem log / khởi động lại:**
```bash
docker compose logs -f app      # theo dõi log
docker compose restart app      # restart
docker compose down             # dừng (volume DB vẫn còn)
```

**Seed dữ liệu mẫu (nếu cần, chỉ chạy 1 lần):**
```bash
docker compose exec app bun run --filter './apps/server' db:seed
```

---

## Checklist tổng
- [ ] VM A1 Ubuntu đã RUNNING, có Public IP
- [ ] Mở cổng 80/443 ở Security List **và** iptables
- [ ] Cài Docker + compose
- [ ] Sửa 3 điểm code (entrypoint migrate, VITE_API_URL, env domain)
- [ ] Tạo `.env` với `BETTER_AUTH_SECRET` ngẫu nhiên
- [ ] `docker compose up -d --build` → health check OK
- [ ] (Khuyến nghị) Caddy HTTPS + domain
- [ ] Đặt lịch backup file `app.db`
