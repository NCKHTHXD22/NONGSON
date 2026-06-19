const axios = require('axios');

let _accessToken = process.env.ZALO_OA_TOKEN || '';
let _refreshToken = process.env.ZALO_REFRESH_TOKEN || '';
let _refreshTimer = null;

const EXPIRES_IN_MS = 90000 * 1000;
const REFRESH_BEFORE_MS = 2 * 60 * 60 * 1000;

async function redisCmd(...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await axios.post(url, args, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    return res.data.result;
  } catch (err) {
    console.error('[Redis]', err.message);
    return null;
  }
}

function getToken() {
  return _accessToken;
}

function scheduleRefresh(delayMs) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = setTimeout(async () => {
    console.log('[ZaloToken] Proactive refresh token trước khi hết hạn...');
    try {
      await refreshAccessToken();
    } catch (err) {
      console.error('[ZaloToken] Proactive refresh thất bại:', err.message);
      scheduleRefresh(10 * 60 * 1000);
    }
  }, delayMs);
  const hours = Math.round(delayMs / 3600000 * 10) / 10;
  console.log(`[ZaloToken] Sẽ tự refresh sau ${hours} giờ`);
}

async function refreshAccessToken() {
  const appId = process.env.ZALO_APP_ID;
  const appSecret = process.env.ZALO_APP_SECRET;
  const refreshToken = _refreshToken || process.env.ZALO_REFRESH_TOKEN;

  if (!appId || !appSecret || !refreshToken) {
    throw new Error('Thiếu ZALO_APP_ID / ZALO_APP_SECRET / ZALO_REFRESH_TOKEN');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('app_id', appId);
  params.append('refresh_token', refreshToken);

  const res = await axios.post(
    'https://oauth.zaloapp.com/v4/oa/access_token',
    params,
    { headers: { secret_key: appSecret, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, refresh_token } = res.data;
  if (!access_token) throw new Error(`Refresh thất bại: ${JSON.stringify(res.data)}`);

  _accessToken = access_token;
  if (refresh_token) _refreshToken = refresh_token;

  await redisCmd('SET', 'nongson_zalo_access_token', access_token);
  if (refresh_token) await redisCmd('SET', 'nongson_zalo_refresh_token', refresh_token);
  console.log('[ZaloToken] Refresh thành công, đã lưu vào Redis');

  scheduleRefresh(EXPIRES_IN_MS - REFRESH_BEFORE_MS);
  return access_token;
}

(async () => {
  const savedAccess = await redisCmd('GET', 'nongson_zalo_access_token');
  const savedRefresh = await redisCmd('GET', 'nongson_zalo_refresh_token');

  if (savedAccess) {
    _accessToken = savedAccess;
    console.log('[ZaloToken] Đọc access token từ Redis');
  }
  if (savedRefresh) {
    _refreshToken = savedRefresh;
    console.log('[ZaloToken] Đọc refresh token từ Redis');
  }

  try {
    await refreshAccessToken();
    console.log('[ZaloToken] Khởi động: Lấy access token mới thành công');
  } catch (err) {
    console.error('[ZaloToken] Khởi động: Không thể refresh:', err.message);
    if (_accessToken) {
      console.warn('[ZaloToken] Dùng token hiện có làm fallback, retry sau 10 phút');
    }
    scheduleRefresh(10 * 60 * 1000);
  }
})();

async function setTokensManually(accessToken, refreshToken) {
  _accessToken = accessToken;
  _refreshToken = refreshToken;
  await redisCmd('SET', 'nongson_zalo_access_token', accessToken);
  await redisCmd('SET', 'nongson_zalo_refresh_token', refreshToken);
  console.log('[ZaloToken] Token được set thủ công, đã lưu vào Redis');
  scheduleRefresh(EXPIRES_IN_MS - REFRESH_BEFORE_MS);
}

module.exports = { getToken, refreshAccessToken, setTokensManually };
