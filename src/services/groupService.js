const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');

let _cache = null;

// ─── Redis helpers ───
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
    console.error('[Redis/Group]', err.message);
    return null;
  }
}

// ─── File fallback ───
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromFile() {
  try {
    if (!fs.existsSync(GROUPS_FILE)) return null;
    return JSON.parse(fs.readFileSync(GROUPS_FILE, 'utf-8'));
  } catch { return null; }
}

function saveToFile(groups) {
  try {
    ensureDataDir();
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups));
  } catch (e) {
    console.warn('[Group] Không lưu được file:', e.message);
  }
}

async function saveGroups(groups) {
  const saved = await redisCmd('SET', 'nongson_oa_groups', JSON.stringify(groups));
  if (saved === null) saveToFile(groups);
}

// ─── Public API ───
async function getStoredGroups() {
  if (_cache) return _cache;

  const raw = await redisCmd('GET', 'nongson_oa_groups');
  if (raw) {
    try { _cache = JSON.parse(raw); return _cache; } catch { /* fall through */ }
  }

  const fromFile = loadFromFile();
  if (fromFile) { _cache = fromFile; return _cache; }

  return [];
}

async function addGroup({ group_id, name }) {
  const groups = await getStoredGroups();
  const idx = groups.findIndex(g => g.group_id === group_id);
  if (idx >= 0) {
    groups[idx] = { ...groups[idx], name, group_id };
  } else {
    groups.push({ group_id, name, added_at: new Date().toISOString() });
  }
  _cache = groups;
  await saveGroups(groups);
  return groups;
}

async function removeGroup(groupId) {
  const groups = await getStoredGroups();
  const filtered = groups.filter(g => g.group_id !== groupId);
  _cache = filtered;
  await saveGroups(filtered);
  return filtered;
}

module.exports = { getStoredGroups, addGroup, removeGroup };
