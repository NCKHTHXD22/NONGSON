# Zalo OA – UBND Nông Sơn

Hệ thống quản trị Zalo Official Account cho UBND Nông Sơn: tiếp nhận góp ý/phản ánh của người dân qua Zalo, quản lý người theo dõi OA, gửi tin nhắn broadcast (tức thì + lên lịch), tra cứu lịch cắt điện EVNCPC, và thống kê.

## Kiến trúc

```
Frontend (React/Vite, Vercel) ↔ Backend (Node/Express, VPS + PM2 + Nginx) ↔ MongoDB Atlas / Upstash Redis ↔ Zalo OA API / EVNCPC API
```

- **Backend** nhận webhook từ Zalo OA, lưu phản ánh/người theo dõi vào MongoDB, refresh Zalo token tự động qua Upstash Redis, cào lịch cắt điện từ EVNCPC theo cron.
- **Frontend** là SPA quản trị (đăng nhập, xem/phản hồi góp ý, quản lý người dùng & danh mục, gửi broadcast, xem thống kê).
- Backend còn có một dashboard quản trị dựng sẵn bằng EJS (`/admin`) song song với SPA React, dùng cho các thao tác nhanh.

## Cấu trúc thư mục

| Thư mục | Nội dung |
|---|---|
| [Backend/](Backend/) | API Express (`server.js`, `src/`), models MongoDB, webhook/scheduler Zalo, cào lịch cắt điện EVNCPC, dashboard EJS (`/admin`) |
| [Frontend/Web/](Frontend/Web/) | SPA React + Vite + Tailwind, gọi REST API của Backend qua `/api` |
| [Documents/](Documents/) | Tài liệu vận hành — quy trình deploy lên VPS ([DEPLOY.md](Documents/DEPLOY.md)), nhật ký ngữ cảnh dự án ([AI_CONTEXT.md](Documents/AI_CONTEXT.md)) |

## Tính năng chính

- Tiếp nhận & xử lý góp ý/phản ánh qua webhook Zalo OA, phân loại theo danh mục.
- Quản lý người theo dõi OA và nhóm Zalo.
- Gửi tin nhắn broadcast tới người dùng/nhóm — gửi ngay hoặc lên lịch (cron mỗi phút, xử lý atomic để tránh gửi trùng khi có nhiều instance).
- Tra cứu lịch cắt điện khu vực Nông Sơn (mã đơn vị `PC05MM`, thuộc EVNCPC) — tự động cào dữ liệu định kỳ.
- Dashboard thống kê, quản lý tài khoản quản trị viên.

## Nguồn gốc dự án

Codebase được clone & tuỳ biến theo chuỗi: `QUESON` → `VUGIA` → `NONGSON` (chi tiết: [Documents/AI_CONTEXT.md](Documents/AI_CONTEXT.md)).

## Chạy local

**Backend** (cần `Backend/.env` — xem các biến môi trường trong [src/config/index.js](Backend/src/config/index.js)):

```bash
cd Backend
npm install
npm run dev      # nodemon, mặc định cổng theo PORT trong .env
```

**Frontend**:

```bash
cd Frontend/Web
npm install
npm run dev      # Vite dev server, mặc định http://localhost:5173
```

Frontend gọi API qua biến `VITE_API_URL` (xem [Frontend/Web/src/lib](Frontend/Web/src/lib)).

## Công nghệ

- **Backend**: Node.js 20, Express, Mongoose (MongoDB), Upstash Redis (lưu Zalo token), Cloudinary (ảnh), node-cron (lịch gửi tin + cào lịch cắt điện), EJS (admin dashboard).
- **Frontend**: React 19, Vite, React Router, TanStack Query, Tailwind CSS, Radix UI.

## Triển khai

Backend chạy trên VPS (PM2 + Nginx + Certbot), Frontend trên Vercel. Quy trình chi tiết: [Documents/DEPLOY.md](Documents/DEPLOY.md).
