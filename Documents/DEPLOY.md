# Deploy backend lên VPS Bitzfly

Quy trình chung để deploy 1 backend Node.js (Express) lên VPS Bitzfly, dùng cho các dự án Zalo OA theo từng xã (DAKPRING, hoatien, dailoc...) chạy chung 1 VPS.

**Kiến trúc:** Frontend (Vercel) ↔ Backend (VPS + PM2 + Nginx + Certbot) ↔ MongoDB Atlas / Upstash Redis ↔ Zalo OA API

## 0. Thông số cụ thể cho dự án NongSon

| | |
|---|---|
| VPS | `123.30.48.104` (dùng chung với hoatien :3000, vietan :3001, dakpring :3002, dailoc :3003, anhai :3004, vugia :3005) |
| App dir | `/var/www/nongson` |
| Port | `3006` |
| PM2 process | `nongson-backend` |
| Domain | `nongson.dxvtech.vn` (A record đã trỏ về VPS) |
| Repo GitHub | `https://github.com/NCKHTHXD22/NONGSON.git` |
| Cấu trúc repo | `Backend/` + `Frontend/Web/` (giống `anhai`) |
| SSH key admin | `~/.ssh/nongson_deploy` |
| SSH key CI/CD | `~/.ssh/nongson_github_deploy` |

Các bước dưới đây là quy trình chung — thay `<app>` = `nongson`, `<port>` = `3006`, `<domain>` = `nongson.dxvtech.vn`.

## 1. SSH access

Tạo keypair riêng cho từng việc — 1 key cho admin, 1 key riêng **chỉ để CI/CD** dùng (không dùng chung key cá nhân):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/<app>_deploy -N ""
ssh-keygen -t ed25519 -f ~/.ssh/<app>_github_deploy -N ""
```

Cài public key vào `~/.ssh/authorized_keys` trên VPS (qua SSH có sẵn, hoặc 1 lần bằng password nếu chưa có access).

## 2. Khảo sát VPS trước khi đụng gì

Bắt buộc nếu VPS đã có app khác — tránh trùng port/tên app:

```bash
pm2 list                          # xem port/tên app đã dùng
ls /etc/nginx/sites-available/    # xem pattern nginx đang dùng (copy theo)
ss -tlnp | grep node              # xem port nào đang free
```

## 3. Provision app

```bash
mkdir -p /var/www/<app> && cd /var/www/<app>
git clone <repo-url> .
# Nếu repo theo cấu trúc Backend/ + Frontend/ (như An Hải): .env nằm trong Backend/.env
cd Backend
# Tạo .env (copy giá trị thật từ host cũ, không tạo mới)
npm install --omit=dev
cd ..
pm2 start server.js --name <app>-backend --cwd /var/www/<app>/Backend
pm2 save
curl http://localhost:<port>/health   # sanity check
```

⚠️ **Gotcha `--cwd`**: PM2 resolve script path **tương đối với `--cwd`**, không phải với thư mục hiện tại của shell. `pm2 start Backend/server.js --cwd Backend` sẽ tìm sai ở `Backend/Backend/server.js`. Luôn dùng: script path tương đối với cwd (`server.js`), `--cwd` là đường dẫn tuyệt đối tới `Backend/`.

## 4. DNS + Nginx + SSL

- Thêm A record: `<subdomain>` → IP VPS. Kiểm tra trước khi làm SSL:
  ```bash
  nslookup <domain> 8.8.8.8
  ```
- Tạo `/etc/nginx/sites-available/<app>`, copy pattern từ app đã có (chỉ đổi `server_name` + `proxy_pass` port):
  ```nginx
  server {
      listen 80;
      server_name <domain>;
      location / {
          proxy_pass http://localhost:<port>;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_cache_bypass $http_upgrade;
      }
  }
  ```
  ```bash
  ln -sf /etc/nginx/sites-available/<app> /etc/nginx/sites-enabled/<app>
  nginx -t && systemctl reload nginx
  ```
- Cài SSL:
  ```bash
  certbot --nginx -d <domain> --non-interactive --agree-tos -m <email> --redirect
  ```

## 5. CI/CD (GitHub Actions)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: SSH vào VPS và deploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_PRIVATE_KEY }}
          port: ${{ secrets.VPS_PORT || 22 }}
          script: |
            set -e
            cd ${{ secrets.VPS_APP_DIR }}
            git fetch origin main
            git reset --hard origin/main
            cd Backend && npm install --omit=dev && cd ..
            cd Frontend/Web && npm install && npm run build && cd ../..
            pm2 delete <app>-backend 2>/dev/null || true
            pm2 start server.js --name <app>-backend --cwd ${{ secrets.VPS_APP_DIR }}/Backend
            pm2 save
            echo "✅ Deploy xong: $(date)"
```

(Nếu repo không có frontend build trong cùng pipeline, hoặc không theo cấu trúc Backend/Frontend, bỏ 2 dòng `cd Frontend/Web...` và đổi `--cwd .../Backend` lại thành `--cwd ${{ secrets.VPS_APP_DIR }}`.)

⚠️ **`set -e` + `git reset --hard`**: bắt buộc cho pipeline tự động. Không có `set -e`, 1 lệnh lỗi giữa chừng (ví dụ `git pull` bị conflict do có local change chưa commit — thường do build trước đó vô tình sửa `package-lock.json`) sẽ không dừng script, các lệnh sau vẫn chạy trên code CŨ mà không ai biết — gây outage âm thầm. `git reset --hard origin/main` đảm bảo VPS luôn khớp y nguyên origin/main, không bao giờ bị kẹt bởi local diff (file `.env`/`node_modules` không bị ảnh hưởng vì không nằm trong git).

⚠️ **Gotcha PM2**: `pm2 restart <app>` KHÔNG đổi lại script path/cwd nếu vị trí file gốc đã thay đổi (ví dụ sau khi tái cấu trúc thư mục) — nó chỉ restart đúng config cũ. Phải `pm2 delete` rồi `pm2 start` lại với path/`--cwd` mới, như trên.

4 secrets cần thêm (GitHub repo → Settings → Secrets and variables → Actions):

| Secret | Giá trị |
|---|---|
| `VPS_HOST` | IP VPS |
| `VPS_USER` | `root` |
| `VPS_PRIVATE_KEY` | private key của key CI/CD riêng (bước 1) |
| `VPS_APP_DIR` | `/var/www/<app>` |

⚠️ **Gotcha**: push file trong `.github/workflows/` sẽ bị GitHub reject nếu Personal Access Token thiếu scope **`workflow`**. Tạo token có sẵn scope tại:
`https://github.com/settings/tokens/new?scopes=repo,workflow`

## 6. Frontend (Vercel)

Nếu repo theo cấu trúc `Backend/` + `Frontend/Web/`: set **Root Directory** của project Vercel = `Frontend/Web` (không phải `Web`).

Set biến môi trường rồi redeploy:

```
VITE_API_URL=https://<domain-vps-moi>
```

## 7. Zalo OA console (nếu backend có webhook/OAuth Zalo)

Thứ tự bắt buộc — sai thứ tự sẽ verify fail:

1. **Verify domain mới trước** (Zalo cho meta tag hoặc file `zalo_verifierXXXX.html` — thêm vào code nếu domain mới chưa từng verify, route file đó public không cần auth).
2. Sau khi domain verify xong, đổi **Webhook URL** → `https://<domain>/webhook`.
3. Đổi **OAuth Callback URL** → `https://<domain>/oauth` (hoặc route OAuth tương ứng).
4. Giữ domain cũ trong danh sách verify cho tới khi domain mới chạy ổn định, không xoá vội.

## 8. Cutover

Theo dõi vài ngày (webhook thật, cron, OAuth) trước khi tắt host cũ (Render/...).

## Gotcha khác đã gặp

- Trên Windows chưa có `sshpass`/`plink`: dùng package `ssh2` (npm) cài tạm vào thư mục temp để tự động hoá SSH bằng password đúng 1 lần (cài public key mới), sau đó luôn chuyển sang key-based và xoá script chứa password ngay.
- Không nhúng GitHub PAT thẳng vào git remote URL (`https://ghp_xxx@github.com/...`) trên VPS — lộ token trong `git remote -v`. Ưu tiên SSH deploy key hoặc PAT chỉ lưu trong GitHub Actions secret.
- Domain verify Zalo có thể đã pass ngay nếu route verifier cũ trong code đã match sẵn — kiểm tra `pm2 logs` thực tế trước khi giả định cần sửa code.
