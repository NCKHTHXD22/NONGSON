require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  MONGO_URI: process.env.MONGO_URI || '',
  ZALO_APP_ID: process.env.ZALO_APP_ID || '',
  ZALO_APP_SECRET: process.env.ZALO_APP_SECRET || '',
  ZALO_OA_TOKEN: process.env.ZALO_OA_TOKEN || '',
  ZALO_REFRESH_TOKEN: process.env.ZALO_REFRESH_TOKEN || '',
  ZALO_GROUP_ID: process.env.ZALO_GROUP_ID || '',
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  PUBLIC_URL: process.env.PUBLIC_URL || '',

  // ===== IOCTC (Tra cứu hồ sơ hành chính) =====
  IOCTC_BASE_URL: process.env.IOCTC_BASE_URL || '',
  IOCTC_USERNAME: process.env.IOCTC_USERNAME || '',
  IOCTC_PASSWORD: process.env.IOCTC_PASSWORD || '',

  // ===== DAWACO Proxy (Lịch cắt nước Đà Nẵng) =====
  DAWACO_PROXY_URL: process.env.DAWACO_PROXY_URL || 'http://103.107.182.191:3456',
  DAWACO_PROXY_KEY: process.env.DAWACO_PROXY_KEY || 'zalo2025secret',

  // ===== EVNCPC (Lịch cắt điện) =====
  EVNCPC_API_URL: process.env.EVNCPC_API_URL || 'https://cskh-api.cpc.vn/api/remote/outages/area',
  EVNCPC_ORG_LIST_URL: process.env.EVNCPC_ORG_LIST_URL || 'https://cskh-api.cpc.vn/api/remote/organizations',
  EVNCPC_ORG_CODE: process.env.EVNCPC_ORG_CODE || 'PP',          // Công ty Điện lực Đà Nẵng (cào toàn bộ)
  EVNCPC_SUBORG_CODE: process.env.EVNCPC_SUBORG_CODE || 'PC05MM', // mặc định lọc khi tra cứu: Điện lực Nong Son
};
