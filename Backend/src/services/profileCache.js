const axios = require('axios');

async function redisCmd(...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await axios.post(url, args, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    return res.data.result;
  } catch { return null; }
}

// Lưu profile user vào Redis (key: nongson_profile:{userId})
async function saveProfile(userId, displayName, avatar = '') {
  if (!userId || !displayName || displayName === userId) return;
  const key = `nongson_profile:${userId}`;
  const value = JSON.stringify({ display_name: displayName, avatar: avatar || '' });
  await redisCmd('SET', key, value, 'EX', 60 * 60 * 24 * 90); // TTL 90 ngày
}

// Lấy profile của nhiều userId cùng lúc từ Redis
async function getProfiles(userIds) {
  if (!userIds?.length) return {};
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return {};

  const result = {};
  try {
    // MGET để lấy tất cả cùng lúc
    const keys = userIds.map(id => `nongson_profile:${id}`);
    const res = await axios.post(url, ['MGET', ...keys], {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const values = res.data.result || [];
    userIds.forEach((id, i) => {
      if (values[i]) {
        try { result[id] = JSON.parse(values[i]); } catch { /* ignore parse error */ }
      }
    });
  } catch { /* ignore redis error */ }
  return result;
}

module.exports = { saveProfile, getProfiles };
