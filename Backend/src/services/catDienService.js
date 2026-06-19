const axios = require('axios');
const cron = require('node-cron');
const CONFIG = require('../config');
const PowerOutage = require('../models/PowerOutage');
const { sendZaloText, uploadImageToZalo, sendZaloImage } = require('../utils/zaloApi');
const { htmlToPng } = require('../utils/imageGen');

const DAYS_AHEAD = 14;
const CARD_MAX_ITEMS = 15;

function fmt(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// ─── Danh sách đơn vị con (điện lực quận/huyện) của Điện lực Đà Nẵng ───
async function fetchSubOrgs() {
  const res = await axios.get(CONFIG.EVNCPC_ORG_LIST_URL, {
    headers: { version: '1.0' },
    params: { maDonViCapTren: CONFIG.EVNCPC_ORG_CODE },
    timeout: 20000,
  });
  return (res.data || []).map((o) => ({ code: o.code, name: o.organizationName }));
}

// ─── Lịch cắt điện của 1 đơn vị con (BẮT BUỘC subOrgCode) ───
async function fetchOutagesForSubOrg(subOrgCode) {
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(); to.setDate(to.getDate() + DAYS_AHEAD); to.setHours(23, 59, 59, 0);

  const items = [];
  for (let page = 1; page <= 50; page++) {
    const res = await axios.get(CONFIG.EVNCPC_API_URL, {
      headers: { version: '1.0', Accept: 'application/json' },
      params: {
        orgCode: CONFIG.EVNCPC_ORG_CODE, subOrgCode,
        fromDate: fmt(from), toDate: fmt(to), page, limit: 100,
      },
      timeout: 20000,
    });
    const batch = res.data?.items || [];
    items.push(...batch);
    if (batch.length === 0) break;
    await new Promise(r => setTimeout(r, 500)); // Delay between pages
  }
  return items;
}

// Chuẩn hoá 1 mục EVNCPC → document PowerOutage
function toDoc(it) {
  return {
    subOrgCode: it.subOrganizationCode || '',
    subOrgName: it.subOrganizationName || '',
    stationCode: it.stationCode || '',
    stationName: it.stationName || '',
    fromDate: it.fromDate ? new Date(it.fromDate) : null,
    toDate: it.toDate ? new Date(it.toDate) : null,
    fromDateStr: it.fromDateStr || '',
    toDateStr: it.toDateStr || '',
    outageType: it.outageType || '',
    statusStr: it.statusStr || '',
    reason: it.reason || '',
    crawledAt: new Date(),
  };
}

// ─── Cào TOÀN BỘ Điện lực Đà Nẵng (mọi đơn vị con) ───
async function fetchAllOutages() {
  const subOrgs = await fetchSubOrgs();
  const all = [];
  for (const so of subOrgs) {
    try {
      const items = await fetchOutagesForSubOrg(so.code);
      for (const it of items) {
        const doc = toDoc(it);
        if (!doc.subOrgCode) doc.subOrgCode = so.code;
        if (!doc.subOrgName) doc.subOrgName = so.name;
        all.push(doc);
      }
    } catch (e) {
      console.warn(`[CatDien] Bỏ qua đơn vị ${so.name}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 350)); // lịch sự với API (tránh 429)
  }
  return all;
}

// ─── Cào + lưu vào Mongo (upsert chống trùng) ───
async function syncOutages() {
  const docs = await fetchAllOutages();
  let upserted = 0;
  for (const doc of docs) {
    if (!doc.stationCode || !doc.fromDate || !doc.toDate) continue;
    await PowerOutage.updateOne(
      { stationCode: doc.stationCode, fromDate: doc.fromDate, toDate: doc.toDate },
      { $set: doc },
      { upsert: true }
    );
    upserted++;
  }
  console.log(`[CatDien] Đồng bộ ${upserted} lịch cắt điện toàn Điện lực Đà Nẵng`);
  return upserted;
}

// ─── Truy vấn từ Mongo: tách theo đơn vị (subOrgCode) + lọc trạm/ngày ───
// subOrgCode mặc định = đơn vị của OA này (Nong Son). Truyền '' hoặc 'all' để xem toàn TP.
async function getOutages(query = '', subOrgCode = CONFIG.EVNCPC_SUBORG_CODE) {
  const q = (query || '').toLowerCase().trim().normalize('NFC');
  const now = new Date();
  const vnNow = new Date(now.getTime() + (7 * 3600000));
  const startOfToday = new Date(Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate(), -7, 0, 0, 0));

  const filter = {};
  if (subOrgCode && subOrgCode !== 'all') filter.subOrgCode = subOrgCode;

  const dateMatch = q.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dateMatch) {
    const [, d, m] = dateMatch;
    const y = vnNow.getUTCFullYear();
    const start = new Date(Date.UTC(y, parseInt(m) - 1, parseInt(d), -7, 0, 0, 0));
    const end = new Date(Date.UTC(y, parseInt(m) - 1, parseInt(d), 16, 59, 59, 999));
    filter.fromDate = { $gte: start, $lte: end };
  } else {
    filter.toDate = { $gte: startOfToday }; // chỉ lịch còn hiệu lực
    if (q && !['tất cả', 'tat ca', 'tatca'].includes(q)) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { stationName: regex },
        { reason: regex }
      ];
    }
  }

  return PowerOutage.find(filter).sort({ fromDate: 1 }).limit(50).lean();
}

// ─── Render card ảnh + gửi qua Zalo ───
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pad(n) { return String(n).padStart(2, '0'); }
function dDate(d) {
  const x = new Date(new Date(d).getTime() + 7 * 3600000);
  return `${pad(x.getUTCDate())}/${pad(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
}
function dTime(d) {
  const x = new Date(new Date(d).getTime() + 7 * 3600000);
  return `${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}`;
}
function typeColor(t) {
  const x = (t || '').toLowerCase();
  if (x.includes('sự cố') || x.includes('đột xuất')) return '#e53935';
  return '#FB8C00';
}

function getCardHtml(items, query = '') {
  const shown = items.slice(0, CARD_MAX_ITEMS);
  const rows = shown.map((it) => {
    const station = escapeHtml(it.stationName || '—');
    const type = escapeHtml(it.outageType || '');
    const color = typeColor(it.outageType);
    const ngay = escapeHtml(dDate(it.fromDate));
    const tu = escapeHtml(dTime(it.fromDate));
    const den = escapeHtml(dTime(it.toDate));
    const reason = escapeHtml((it.reason || '').trim());
    return `<div class="item">
      <div class="row1"><span class="station">${station}</span><span class="badge" style="background:${color}">${type}</span></div>
      <div class="time">📅 ${ngay} &nbsp;|&nbsp; ⏰ ${tu} – ${den}</div>
      ${reason ? `<div class="reason">${reason}</div>` : ''}
    </div>`;
  }).join('');
  const more = items.length > CARD_MAX_ITEMS
    ? `<div class="more">… và ${items.length - CARD_MAX_ITEMS} khu vực khác. Nhắn tên trạm để xem cụ thể.</div>` : '';
  const empty = `<div class="empty">✅ Hiện không có lịch tạm ngừng cấp điện${query ? ` cho "<b>${escapeHtml(query)}</b>"` : ''}.<br>Thử nhập tên trạm khác hoặc ngày (vd 12/06).</div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; background:#fff; width:520px; }
.card { width:520px; border:1px solid #e0e0e0; border-radius:10px; overflow:hidden; }
.header { background:#EF6C00; padding:14px 18px; display:flex; align-items:center; gap:12px; }
.logo { width:44px; height:44px; background:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
.htitle { color:#fff; font-size:15px; font-weight:bold; }
.hsub { color:rgba(255,255,255,.85); font-size:12px; margin-top:3px; }
.item { padding:12px 18px; border-bottom:1px solid #f0f0f0; }
.item:last-child { border-bottom:none; }
.row1 { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:5px; }
.station { font-size:13px; font-weight:bold; color:#1a1a1a; }
.badge { color:#fff; font-size:11px; font-weight:bold; padding:2px 9px; border-radius:5px; white-space:nowrap; }
.time { font-size:12px; color:#EF6C00; font-weight:bold; margin-bottom:4px; }
.reason { font-size:12px; color:#555; line-height:1.4; }
.more { padding:10px 18px; font-size:12px; color:#888; font-style:italic; }
.empty { padding:22px 18px; font-size:14px; color:#2e7d32; text-align:center; line-height:1.5; }
.footer { background:#f5f5f5; padding:8px 18px; font-size:11px; color:#888; text-align:right; }
</style></head><body><div class="card">
  <div class="header">
    <div class="logo">⚡</div>
    <div>
      <div class="htitle">Lịch tạm ngừng cấp điện — Nong Son</div>
      <div class="hsub">${query ? `Tra cứu: ${escapeHtml(query)} · ` : ''}Nguồn: EVNCPC</div>
    </div>
  </div>
  ${items.length ? rows + more : empty}
  <div class="footer">Cập nhật: ${new Date().toLocaleString('vi-VN')}</div>
</div></body></html>`;
}

function formatText(items, query = '') {
  if (!items.length) {
    return `✅ Hiện không có lịch tạm ngừng cấp điện${query ? ` cho "${query}"` : ''}.\n\n📍 Nguồn: EVNCPC`;
  }
  const TEXT_MAX_ITEMS = 7;
  const shown = items.slice(0, TEXT_MAX_ITEMS);
  const lines = shown.map((it, i) => {
    const reasonStr = it.reason ? `\n   ℹ️ Chi tiết: ${it.reason.trim()}` : '';
    return `${i + 1}. ${it.stationName} [${it.outageType}]\n   ⏰ ${dDate(it.fromDate)} ${dTime(it.fromDate)} – ${dTime(it.toDate)}${reasonStr}`;
  });
  if (items.length > TEXT_MAX_ITEMS) {
    lines.push(`... và ${items.length - TEXT_MAX_ITEMS} khu vực khác. Nhắn tên trạm để xem cụ thể.`);
  }
  return `⚡ LỊCH TẠM NGỪNG CẤP ĐIỆN — nong son\n━━━━━━━━━━━━━━━━━━━\n${lines.join('\n\n')}\n━━━━━━━━━━━━━━━━━━━\n📍 Nguồn: EVNCPC`;
}

// Tra cứu + gửi card ảnh (fallback text nếu render lỗi). Trả về số mục tìm được.
async function sendOutageCard(userId, query = '') {
  const items = await getOutages(query);
  try {
    const filepath = await htmlToPng(getCardHtml(items, query));
    const attachmentId = await uploadImageToZalo(filepath);
    await sendZaloImage(userId, attachmentId);
  } catch (err) {
    console.error('[CatDien] Lỗi render card, fallback text:', err.message);
    await sendZaloText(userId, formatText(items, query));
  }
  return items.length;
}

// ─── Cron tự động cào toàn TP mỗi 30 phút ───
function startAutoSync() {
  syncOutages().catch((e) => console.error('[CatDien] Sync lần đầu lỗi:', e.message));
  cron.schedule('*/30 * * * *', () => {
    syncOutages().catch((e) => console.error('[CatDien] Sync định kỳ lỗi:', e.message));
  });
  console.log('[CatDien] Đã bật tự động đồng bộ lịch cắt điện (mỗi 30 phút)');
}

module.exports = { fetchSubOrgs, fetchOutagesForSubOrg, fetchAllOutages, syncOutages, getOutages, getCardHtml, sendOutageCard, startAutoSync };
