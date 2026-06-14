# AI CONTEXT & MEMORY LOG - DỰ ÁN NONGSON

*File này được tạo ra để lưu trữ bộ nhớ và ngữ cảnh làm việc cho AI Assistant. Khi bạn mở thư mục này trong một phiên làm việc mới, AI có thể đọc file này để nắm bắt ngay tiến độ.*

## 1. Nguồn Gốc Dự Án
- **Khởi nguồn:** Dự án gốc là `QUESON` (zalo-oa-queson-goopy).
- **Lịch sử Clone:** Từ `QUESON` -> `VUGIA` -> `NONGSON`.
- **Mục tiêu:** Hệ thống Webhook Zalo OA và Admin Dashboard (React + EJS) dùng để tiếp nhận phản ánh, gửi thông báo và tra cứu lịch cắt điện cho "UBND Xã Nông Sơn".

## 2. Công Nghệ Sử Dụng (Tech Stack)
- **Backend:** Node.js (Express.js), MongoDB (Mongoose), Node-Cron (đặt lịch).
- **Frontend (Admin):** React.js (Vite), TailwindCSS.
- **Tích hợp:** API Zalo OA (Gửi tin nhắn, Lấy danh sách người quan tâm), API Lịch Cắt Điện EVNCPC.

## 3. Các Thay Đổi Đã Thực Hiện Cho NÔNG SƠN
- Toàn bộ source code đã được tìm-và-thay-thế (Find & Replace):
  - `vugia` -> `nongson`
  - `Vũ Gia` -> `Nông Sơn`
- **Lịch cắt điện (EVN):** Đã cấu hình mã Điện lực quản lý Nông Sơn là **`PC05MM`** (Điện lực Quế Sơn) trong `src/config/index.js` và `scripts/fetch_data_LichCat_Dien.js`. Cron-job tự động cào lịch mỗi 30 phút.
- Đã chạy `npm install` thành công cho cả Backend (root) và Frontend (`/Web`).

## 4. Công Việc Cần Làm Tiếp Theo (Pending Tasks)
1. **Cấu hình Biến Môi Trường:**
   - Mở file `.env` (hiện tại đang lấy mẫu từ bản cũ) và điền các thông tin Zalo của **Nông Sơn**:
     - `ZALO_APP_ID`, `ZALO_APP_SECRET`
     - `ZALO_OA_TOKEN`, `ZALO_REFRESH_TOKEN`
2. **Khởi động server & Kiểm tra Webhook:**
   - Chạy Backend: `npm run dev` (Cổng mặc định: 3001).
   - Chạy Frontend: `cd Web` -> `npm run dev`.
   - Lên trang quản lý Zalo for Developers để cập nhật Webhook URL trỏ về server Nông Sơn.
3. **Tuỳ chỉnh riêng (nếu có):**
   - Các file Infographic hướng dẫn (`infographic-huong-dan-phan-anh.html`, v.v.) hiện tại không nằm trong thư mục này do bị exclude ở bản clone trước. Nếu cần, hãy copy lại từ dự án gốc QUESON.

## 5. Cấu Trúc File Quan Trọng Cần Lưu Ý
- `server.js`: File chạy chính của Backend, chứa router và thiết lập CORS/Session.
- `src/handlers/webhookHandler.js`: Logic nhận tin nhắn từ Zalo (Webhook).
- `src/services/catDienService.js`: Logic cào Lịch cắt điện từ PC05MM.
- `src/utils/zaloToken.js`: File tự động refresh Zalo Token qua Redis (Upstash).
- `Web/src/...`: Source code React của trang Admin.
