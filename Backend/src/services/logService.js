const axios = require('axios');

const MAX_LOGS = 500;
const _memLogs = []; // in-memory fallback khi không có Redis

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

async function addLog(entry) {
  const log = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
  };

  const pushed = await redisCmd('LPUSH', 'nongson_msg_log', JSON.stringify(log));
  if (pushed !== null) {
    await redisCmd('LTRIM', 'nongson_msg_log', 0, MAX_LOGS - 1);
  } else {
    _memLogs.unshift(log);
    if (_memLogs.length > MAX_LOGS) _memLogs.length = MAX_LOGS;
  }
}

async function getLogs(limit = 50) {
  const raw = await redisCmd('LRANGE', 'nongson_msg_log', 0, limit - 1);
  if (raw) {
    return raw.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
  }
  return _memLogs.slice(0, limit);
}

async function deleteLog(id) {
  const raw = await redisCmd('LRANGE', 'nongson_msg_log', 0, MAX_LOGS - 1);
  if (raw !== null) {
    const remaining = raw.filter(s => {
      try { return JSON.parse(s).id !== id; } catch { return true; }
    });
    await redisCmd('DEL', 'nongson_msg_log');
    if (remaining.length > 0) {
      // RPUSH để giữ thứ tự (mới nhất ở đầu list)
      for (let i = remaining.length - 1; i >= 0; i--) {
        await redisCmd('LPUSH', 'nongson_msg_log', remaining[i]);
      }
    }
  } else {
    const idx = _memLogs.findIndex(l => l.id === id);
    if (idx !== -1) _memLogs.splice(idx, 1);
  }
}

async function clearAllLogs() {
  const deleted = await redisCmd('DEL', 'nongson_msg_log');
  if (deleted === null) _memLogs.length = 0;
}

module.exports = { addLog, getLogs, deleteLog, clearAllLogs };
