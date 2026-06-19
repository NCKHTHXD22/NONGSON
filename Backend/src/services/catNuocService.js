const axios = require('axios');
const CONFIG = require('../config');
const { sendZaloText, uploadImageToZalo, sendZaloImage } = require('../utils/zaloApi');
const { htmlToPng } = require('../utils/imageGen');

async function fetchWaterOutage(query = '') {
  const res = await axios.get(`${CONFIG.DAWACO_PROXY_URL}/catnuoc`, {
    headers: { 'x-api-key': CONFIG.DAWACO_PROXY_KEY },
    timeout: 15000,
  });
  const allItems = (res.data || []).sort((a, b) => new Date(a.mat_nuoc_tu) - new Date(b.mat_nuoc_tu));

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const q = query.toLowerCase().trim().normalize('NFC');

  if (!q || q === 'tat ca' || q === 'tất cả' || q === 'tatca') {
    return allItems.filter(item => new Date(item.mat_nuoc_den) >= startOfToday).slice(0, 5);
  }

  const dateMatch = q.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dateMatch) {
    const [, d, m] = dateMatch;
    return allItems.filter(item => {
      const dt = new Date(item.mat_nuoc_tu);
      return dt.getDate() === parseInt(d) && (dt.getMonth() + 1) === parseInt(m);
    }).slice(0, 5);
  }

  const kw = q;
  return allItems
    .filter(item => new Date(item.mat_nuoc_den) >= startOfToday)
    .filter(item => {
      const haystack = `${item.title || ''} ${item.content || ''}`.toLowerCase().normalize('NFC');
      return haystack.includes(kw);
    })
    .slice(0, 5);
}

function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  const days = ['CN', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7'];
  return `${days[d.getDay()]} ${d.toLocaleDateString('vi-VN')} lúc ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatWaterOutageText(items) {
  if (!items.length) {
    return '✅ Hiện không có lịch tạm ngưng cấp nước nào trong thời gian tới.\n\n📍 Nguồn: DAWACO Đà Nẵng';
  }
  const lines = items.map((item, i) => {
    const tu = formatDateTime(item.mat_nuoc_tu);
    const den = new Date(item.mat_nuoc_den).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${i + 1}. ${item.title}\n   ⏰ ${tu} → ${den}`;
  });
  return (
    `💧 LỊCH TẠM NGƯNG CẤP NƯỚC\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    lines.join('\n\n') +
    `\n━━━━━━━━━━━━━━━━━━━\n` +
    `📍 Nguồn: DAWACO Đà Nẵng`
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTimeShort(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getWaterOutageCardHtml(items, query = '') {
  const rows = items.map(item => {
    const title = escapeHtml(item.title || '—');
    const tu = escapeHtml(formatTimeShort(item.mat_nuoc_tu));
    const den = escapeHtml(formatTimeShort(item.mat_nuoc_den));
    const ngay = escapeHtml(formatDateShort(item.mat_nuoc_tu));
    const shortContent = escapeHtml((item.content || '').split('\n')[0].trim());
    return `
    <div class="item">
      <div class="item-title">${title}</div>
      <div class="item-time">⏰ ${ngay} &nbsp;|&nbsp; ${tu} – ${den}</div>
      <div class="item-content">${shortContent}</div>
    </div>`;
  }).join('');

  const emptyMsg = query
    ? `<div class="empty">✅ Không tìm thấy lịch cắt nước cho "<b>${escapeHtml(query)}</b>".<br>Thử nhập tên khác hoặc nhắn "tất cả".</div>`
    : `<div class="empty">✅ Hiện không có lịch tạm ngưng cấp nước.</div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; background: white; width: 520px; }
.card { width: 520px; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden; }
.header { background: #0277BD; padding: 14px 18px; display: flex; align-items: center; gap: 12px; }
.logo { width: 44px; height: 44px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.header-title { color: white; font-size: 15px; font-weight: bold; }
.header-sub { color: rgba(255,255,255,0.8); font-size: 12px; margin-top: 3px; }
.body { padding: 4px 0; }
.item { padding: 12px 18px; border-bottom: 1px solid #f0f0f0; }
.item:last-child { border-bottom: none; }
.item-title { font-size: 13px; font-weight: bold; color: #1a1a1a; line-height: 1.4; margin-bottom: 5px; }
.item-time { font-size: 12px; color: #0277BD; font-weight: bold; margin-bottom: 4px; }
.item-content { font-size: 12px; color: #555; line-height: 1.4; }
.empty { padding: 20px 18px; font-size: 14px; color: #2e7d32; text-align: center; }
.footer { background: #f5f5f5; padding: 8px 18px; font-size: 11px; color: #888; text-align: right; }
</style></head>
<body><div class="card">
  <div class="header">
    <div class="logo">💧</div>
    <div>
      <div class="header-title">Lịch tạm ngưng cấp nước</div>
      <div class="header-sub">${query ? `Khu vực: ${escapeHtml(query)} · ` : ''}Nguồn: DAWACO Đà Nẵng</div>
    </div>
  </div>
  <div class="body">${items.length ? rows : emptyMsg}</div>
  <div class="footer">Cập nhật: ${new Date().toLocaleString('vi-VN')}</div>
</div></body></html>`;
}

async function sendWaterOutageCard(userId, query = '') {
  try {
    const items = await fetchWaterOutage(query);
    const filepath = await htmlToPng(getWaterOutageCardHtml(items, query));
    const attachmentId = await uploadImageToZalo(filepath);
    await sendZaloImage(userId, attachmentId);
    console.log('[CatNuoc] Gửi card thành công');
  } catch (err) {
    console.error('[CatNuoc] Lỗi card, fallback về text:', err.message);
    try {
      const items = await fetchWaterOutage(query);
      await sendZaloText(userId, formatWaterOutageText(items));
    } catch (err2) {
      console.error('[CatNuoc] Lỗi fallback:', err2.message);
      await sendZaloText(userId, '⚠️ Không thể lấy lịch cắt nước. Vui lòng thử lại sau.');
    }
  }
}

module.exports = { sendWaterOutageCard };
