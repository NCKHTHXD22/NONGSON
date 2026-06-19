/**
 * Script cài đặt Menu cho Zalo OA "Thông tin xã Nong Son"
 *
 * Chạy: node setup-menu.js
 *
 * Lưu ý: Nếu API trả lỗi, hãy cài menu thủ công trên oa.zalo.me
 * (xem hướng dẫn bên dưới trong file này)
 */

require('dotenv').config();
const axios = require('axios');

const ZALO_OA_TOKEN = process.env.ZALO_OA_TOKEN;

if (!ZALO_OA_TOKEN || ZALO_OA_TOKEN === 'your_zalo_oa_access_token_here') {
  console.error('❌ Chưa cấu hình ZALO_OA_TOKEN trong file .env');
  process.exit(1);
}

// ============================================================
// CẤU HÌNH MENU
// Các item hiện có trên OA xã Nong Son (từ hình ảnh) + thêm Tra cứu hồ sơ
// ============================================================
const menuConfig = {
  data: [
    {
      title: '🏛 Dịch vụ công',
      subtitle: '',
      type: 'ActionOpenURL', // nhóm
      sub_menu: [
        {
          title: '🔍 Tra cứu hồ sơ',
          type: 'text',               // gửi text để kích hoạt chatbot
          payload: '#tracuuhoso',
        },
        {
          title: '🌐 Cổng Dịch vụ công',
          type: 'link',
          payload: 'https://dichvucong.danang.gov.vn',
        },
        {
          title: '📝 Gửi PAKN DVC',
          type: 'link',
          payload: 'https://pakn.danang.gov.vn',
        },
        {
          title: '🏡 Xã Nong Son',
          type: 'link',
          payload: 'https://nongson.danang.gov.vn',
        },
      ],
    },
    {
      title: '🌱 Chuyển đổi số',
      subtitle: '',
      type: 'ActionOpenURL',
      sub_menu: [
        {
          title: '⚡ Tra cứu ngắt điện',
          type: 'text',
          payload: '#lichcatdien',
        },
        {
          title: '💧 Lịch cắt nước',
          type: 'text',
          payload: '#lichcatnuoc',
        },
      ],
    },
  ],
};

// ============================================================
// GỌI API CÀI MENU
// ============================================================
async function setupMenu() {
  console.log('🔧 Đang cài đặt menu Zalo OA...\n');

  try {
    // Thử format v2 của Zalo OA API
    const response = await axios.post(
      'https://openapi.zalo.me/v2.0/oa/menu',
      menuConfig,
      {
        headers: {
          access_token: ZALO_OA_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Kết quả API:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data?.error === 0 || response.data?.errorCode === 0) {
      console.log('\n✅ Cài menu thành công!');
    } else {
      console.log('\n⚠️  API trả về lỗi. Xem hướng dẫn cài thủ công bên dưới.');
      printManualInstructions();
    }
  } catch (err) {
    console.error('❌ Lỗi:', err.response?.data || err.message);
    console.log('\n📋 Hãy cài menu thủ công theo hướng dẫn bên dưới:\n');
    printManualInstructions();
  }
}

function printManualInstructions() {
  console.log(`
================================================================
  HƯỚNG DẪN CÀI MENU THỦ CÔNG TRÊN oa.zalo.me
================================================================

BƯỚC 1: Truy cập https://oa.zalo.me
BƯỚC 2: Chọn OA "Thông tin xã Nong Son"
BƯỚC 3: Vào Cài đặt → Menu (hoặc Công cụ → Menu nhanh)
BƯỚC 4: Thêm mục mới với cấu hình sau:

  MỤC CẦN THÊM:
  ┌─────────────────────────────────────────────────┐
  │ Nhóm : Dịch vụ công                             │
  │ Tên  : Tra cứu hồ sơ                            │
  │ Loại : Gửi tin nhắn (Text action)               │
  │ Nội dung (payload): #tracuuhoso                 │
  └─────────────────────────────────────────────────┘

BƯỚC 5: Lưu lại

================================================================
  LUỒNG HOẠT ĐỘNG SAU KHI CÀI XONG:
================================================================
  User bấm "Tra cứu hồ sơ"
  → Zalo gửi text "#tracuuhoso" đến OA (ẩn với user)
  → Webhook server nhận → trả lời: "Vui lòng nhập mã hồ sơ..."
  → User nhập: H17.18-250626-0015
  → Server tra cứu IOCTC API → trả kết quả dạng thẻ thông tin

================================================================
`);
}

setupMenu();
