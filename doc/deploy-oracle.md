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

## 5. Những gì repo đã làm sẵn cho production

Ba điểm từng phải sửa tay nay đã nằm trong repo:

- **Migration tự chạy khi khởi động**: `docker-entrypoint.sh` chạy `db:migrate` rồi mới start server. Migration lỗi thì container dừng, không chạy trên DB sai schema.
- **Web gọi cùng origin**: không set `VITE_API_URL` thì web gọi `/api/...` đúng domain đang mở (`apiClient.ts`, `auth-client.ts`, `useTransactions.ts`, `useReports.ts` đã đổi mặc định sang `window.location.origin`). Docker bỏ qua `.env` lúc build nên bản build luôn là same-origin.
- **Env theo domain**: `docker-compose.yml` đọc `.env` (bước 7); `BETTER_AUTH_URL`, `FRONTEND_URL`, `PUBLIC_BASE_URL` đều là `https://<APP_DOMAIN>`.

Có sẵn thêm: Caddy (HTTPS tự động), `restart: unless-stopped`, healthcheck, `TZ=Asia/Ho_Chi_Minh`, dừng gọn khi nhận SIGTERM (gộp WAL rồi đóng SQLite), và `.dockerignore` loại `apps/server/data` để file DB local không lọt vào image.
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

Trên VPS, trong thư mục `personal-finance`, tạo `.env` từ mẫu rồi điền giá trị thật:
```bash
cp .env.example .env
sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -hex 32)|" .env
nano .env
```
Các biến cần đặt ở production:

| Biến | Giá trị |
|---|---|
| `APP_DOMAIN` | `finance.example.com` (A record đã trỏ về Public IP) |
| `BETTER_AUTH_URL`, `FRONTEND_URL`, `PUBLIC_BASE_URL` | `https://finance.example.com` (cùng một địa chỉ, vì web và API chung origin) |
| `BETTER_AUTH_SECRET` | chuỗi ngẫu nhiên ≥ 32 ký tự (lệnh `sed` ở trên đã sinh) |
| `AI_PROVIDER`, `OPENROUTER_API_KEY` hoặc `ANTHROPIC_API_KEY` | như bản dev |
| `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_SECRET` | như bản dev (secret ≥ 8 ký tự) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | tùy chọn, bật sao lưu ra ngoài máy chủ (mục 10) |

`docker-compose.yml` tự đặt `DATABASE_URL`, `NODE_ENV=production`, `PORT` và `TZ` (ghi đè `.env`), nên không khai báo ở đây. Không cần `VITE_API_URL`.

> Chưa có domain? Auth cookie cần HTTPS nên vẫn nên có tên miền; có thể dùng subdomain miễn phí (ví dụ DuckDNS) trỏ về Public IP.

---

## 8. Build & chạy

```bash
# Trong thư mục personal-finance trên VPS
docker compose up -d --build
```
Lần build đầu mất vài phút (cài deps + build frontend). Kiểm tra:
```bash
docker compose ps               # app phải "healthy", caddy phải Up
docker compose logs -f app      # thấy {"applied":[...]} của migration, rồi "Started ... server"
docker compose exec app wget -qO- localhost:3000/api/health   # {"status":"ok",...}
```
Cổng 3000 không mở ra ngoài; chỉ Caddy (80/443) nhận kết nối. Mở `https://<APP_DOMAIN>` ở bước 9.

### 8b. Chuyển dữ liệu từ máy local (làm TRƯỚC lần chạy đầu nếu muốn giữ dữ liệu hiện có)

1. Trên máy local, tạo bản chụp nhất quán (an toàn kể cả khi dev server đang chạy):
   ```bash
   sqlite3 apps/server/data/app.db ".backup app-export.db"
   ```
2. Đưa lên VPS: `scp app-export.db ubuntu@<PUBLIC_IP>:~/`
3. Trên VPS, tạo volume rồi chép file vào (các migration còn thiếu sẽ tự chạy khi app khởi động):
   ```bash
   docker compose create app
   docker run --rm -v personal-finance_db-data:/data -v ~/app-export.db:/in/app.db:ro alpine cp /in/app.db /data/app.db
   ```
   Tên volume là `<tên thư mục dự án>_db-data`; xem đúng tên bằng `docker volume ls`.

### 8c. Đăng ký webhook Zalo (một lần, khi `PUBLIC_BASE_URL` đã là HTTPS cố định)
```bash
docker compose exec app bun run apps/server/scripts/zalo-set-webhook.ts
```
Cần `ZALO_BOT_TOKEN`, `ZALO_WEBHOOK_SECRET`, `PUBLIC_BASE_URL` trong `.env`. Khác với quick tunnel, không phải đăng ký lại mỗi lần khởi động. Kiểm tra bằng cách nhắn thử cho bot.

---

## 9. HTTPS với Caddy (đã cấu hình sẵn)

`docker-compose.yml` đã có service `caddy` và `Caddyfile` dùng `{$APP_DOMAIN}`; Caddy tự xin và gia hạn chứng chỉ Let's Encrypt. Điều kiện: A record của `APP_DOMAIN` đã trỏ về Public IP và cổng 80/443 đã mở ở bước 3.

Truy cập `https://<APP_DOMAIN>`. Nếu chứng chỉ chưa được cấp: `docker compose logs caddy`. Nếu từng mở cổng 3000 để thử thì **đóng lại** trong Security List.

---

## 10. Vận hành: update, backup, log

**Cập nhật khi có code mới:**
```bash
cd ~/personal-finance
git pull                        # hoặc rsync lại
docker compose up -d --build    # build lại & restart, volume DB giữ nguyên
```

**Sao lưu tự động (đã có sẵn trong app, chỉ chạy ở production):**

Mỗi ngày từ 02:00 giờ VN (hoặc ngay khi khởi động nếu hôm nay chưa chạy), app tạo `app-YYYYMMDD.db.gz`: bản chụp nhất quán bằng `VACUUM INTO` (an toàn khi DB đang chạy), đã kiểm tra `integrity_check`, nén gzip. Giữ 14 bản gần nhất ở volume `backups` (`/app/backups`) và, nếu có cấu hình `R2_*`, đẩy thêm lên Cloudflare R2.

Bật bản ngoài máy chủ (mất VM vẫn còn dữ liệu):
1. Cloudflare → R2 → tạo bucket **private**.
2. Tạo API token loại *Object Read & Write*, giới hạn riêng cho bucket đó.
3. Điền `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` vào `.env`, rồi `docker compose up -d`.
4. (Khuyến nghị) Thêm lifecycle rule cho prefix `backups/` để tự xóa bản cũ hơn 90 ngày; app không tự xóa trên R2.
5. Kiểm tra: `docker compose logs app | grep backup` phải thấy `app-YYYYMMDD.db.gz (đã đẩy lên R2)` và file hiện trong bucket, dưới `backups/`.

Mỗi ngày chỉ chụp một lần. Nếu hôm nay đã chạy xong rồi mới cấu hình R2, hoặc upload lỗi: tick sau (10 phút) chỉ upload lại bản đã có, không chụp lại. Muốn ép chạy lại ngay:
```bash
docker compose exec app bun -e "new (require('bun:sqlite').Database)('data/app.db').run(\"DELETE FROM job_runs WHERE name='backup'\")"
docker compose restart app
```
Thiếu `R2_*` thì log có dòng cảnh báo `[backup] chưa cấu hình R2_*` và bản sao lưu chỉ nằm trên máy chủ.

**Lấy bản sao lưu ra / khôi phục:**
```bash
# Bản trên máy chủ (hoặc tải app-YYYYMMDD.db.gz từ R2 về)
docker compose cp app:/app/backups/app-20261121.db.gz .
gunzip -c app-20261121.db.gz > restored.db

# Khôi phục: dừng app → thay file DB (xóa cả -wal/-shm của DB cũ) → chạy lại
docker compose stop app
docker run --rm -v personal-finance_db-data:/data -v "$PWD/restored.db":/in/app.db:ro alpine \
  sh -c 'rm -f /data/app.db /data/app.db-wal /data/app.db-shm && cp /in/app.db /data/app.db'
docker compose start app     # migration tự áp dụng nếu bản sao lưu cũ hơn schema hiện tại
```
Nên thử khôi phục một lần vào máy khác trước khi cần đến nó thật.

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
- [ ] A record của tên miền trỏ về Public IP
- [ ] Mở cổng 80/443 ở Security List **và** iptables
- [ ] Cài Docker + compose
- [ ] Tạo `.env` từ `.env.example` (APP_DOMAIN, 3 URL, BETTER_AUTH_SECRET ngẫu nhiên, AI_*, ZALO_*)
- [ ] (Nếu giữ dữ liệu cũ) chuyển `app.db` lên volume — mục 8b
- [ ] `docker compose up -d --build` → `docker compose ps` thấy `app` healthy
- [ ] Mở `https://<APP_DOMAIN>` được và đăng nhập được
- [ ] Đăng ký webhook Zalo — mục 8c, nhắn thử cho bot
- [ ] Bật sao lưu R2 (mục 10) và thử khôi phục một lần
- [ ] Đóng cổng 3000 trong Security List nếu từng mở
