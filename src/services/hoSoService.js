const axios = require('axios');
const CONFIG = require('../config');
const { sendZaloText, uploadImageToZalo, sendZaloImage } = require('../utils/zaloApi');
const { htmlToPng } = require('../utils/imageGen');

let ioctcTokenCache = { token: null, expiry: 0 };

async function getIoctcToken() {
  if (ioctcTokenCache.token && Date.now() < ioctcTokenCache.expiry) return ioctcTokenCache.token;
  console.log('[IOCTC] Đang lấy token mới...');
  const res = await axios.post(
    `${CONFIG.IOCTC_BASE_URL}/getToken`,
    { username: CONFIG.IOCTC_USERNAME, password: CONFIG.IOCTC_PASSWORD },
    { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
  );
  const token = res.data.token;
  if (!token) throw new Error('Không lấy được token từ IOCTC API');
  ioctcTokenCache = { token, expiry: Date.now() + 23 * 60 * 60 * 1000 };
  console.log('[IOCTC] Lấy token thành công');
  return token;
}

async function searchDossier(code) {
  const token = await getIoctcToken();
  const res = await axios.get(`${CONFIG.IOCTC_BASE_URL}/tra-cuu`, {
    headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' },
    params: { ma_ho_so: code.trim().toUpperCase() },
    timeout: 15000,
  });
  console.log('[IOCTC] TongSo:', res.data?.TongSo);
  return res.data;
}

function formatDate(dateField) {
  if (!dateField) return '—';
  const d = dateField['$date'] || dateField;
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function extractDossiers(responseData) {
  if (Array.isArray(responseData?.HoSo)) return responseData.HoSo;
  if (Array.isArray(responseData)) return responseData;
  return [];
}

function formatDossierText(dossier) {
  return (
    `📋 THÔNG TIN HỒ SƠ\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `Mã hồ sơ: ${dossier.MaHoSo || '—'}\n` +
    `Tên dịch vụ: ${dossier.TenTTHC || '—'}\n` +
    `Trạng thái: ${dossier.TenTrangThai || '—'}\n` +
    `Đơn vị xử lý: ${dossier.DonViXuLy || '—'}\n` +
    `Ngày tiếp nhận: ${formatDate(dossier.NgayTiepNhan)}\n` +
    `Hạn giải quyết: ${formatDate(dossier.HanGiaiQuyet)}\n` +
    `Ngày trả kết quả: ${formatDate(dossier.NgayTraKetQua)}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `📍 UBND Nong Son`
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getStatusColor(trangThai) {
  const t = (trangThai || '').toLowerCase();
  if (t.includes('đã trả') || t.includes('trả kết quả')) return '#2196F3';
  if (t.includes('từ chối') || t.includes('không được')) return '#f44336';
  if (t.includes('đang xử lý') || t.includes('đang thụ lý')) return '#FF9800';
  if (t.includes('đã tiếp nhận') || t.includes('chờ xử lý')) return '#4CAF50';
  return '#9E9E9E';
}

function getDossierHtml(dossier) {
  const maHoSo    = escapeHtml(dossier.MaHoSo       || '—');
  const tenDichVu = escapeHtml(dossier.TenTTHC      || '—');
  const donVi     = escapeHtml(dossier.DonViXuLy    || '—');
  const trangThai = escapeHtml(dossier.TenTrangThai || '—');
  const ngayNhan  = escapeHtml(formatDate(dossier.NgayTiepNhan));
  const henTra    = escapeHtml(formatDate(dossier.HanGiaiQuyet));
  const ngayTra   = escapeHtml(formatDate(dossier.NgayTraKetQua));
  const tenNguoi  = escapeHtml(dossier.TenChuHoSo || dossier.HoTen || '—');
  const badgeColor = getStatusColor(dossier.TenTrangThai || '');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; background: white; width: 520px; }
.card { width: 520px; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden; }
.header { background: #1565C0; padding: 14px 18px; display: flex; align-items: center; gap: 12px; }
.logo { width: 44px; height: 44px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.header-title { color: white; font-size: 15px; font-weight: bold; }
.header-sub { color: rgba(255,255,255,0.8); font-size: 12px; margin-top: 3px; }
table { width: 100%; border-collapse: collapse; }
tr { border-bottom: 1px solid #f0f0f0; }
tr:last-child { border-bottom: none; }
tr:nth-child(even) { background: #f9f9f9; }
td { padding: 11px 18px; font-size: 13px; vertical-align: top; }
.label { color: #888; width: 155px; white-space: nowrap; }
.value { color: #222; }
.bold { font-weight: bold; }
.badge { display: inline-block; padding: 3px 12px; border-radius: 5px; font-size: 12px; color: white; font-weight: bold; background: ${badgeColor}; }
</style></head>
<body><div class="card">
  <div class="header">
    <div class="logo">🏛️</div>
    <div>
      <div class="header-title">UBND Nong Son</div>
      <div class="header-sub">Tra cứu hồ sơ hành chính</div>
    </div>
  </div>
  <table>
    <tr><td class="label">Gửi Ông/Bà</td><td class="value">${tenNguoi}</td></tr>
    <tr><td class="label">Mã hồ sơ</td><td class="value bold">${maHoSo}</td></tr>
    <tr><td class="label">Trạng thái</td><td class="value"><span class="badge">${trangThai}</span></td></tr>
    <tr><td class="label">Tên dịch vụ</td><td class="value">${tenDichVu}</td></tr>
    <tr><td class="label">Cơ quan tiếp nhận</td><td class="value">${donVi}</td></tr>
    <tr><td class="label">Nhận lúc</td><td class="value">${ngayNhan}</td></tr>
    <tr><td class="label">Hẹn trả</td><td class="value">${henTra}</td></tr>
    <tr><td class="label">Nhận kết quả</td><td class="value">${ngayTra}</td></tr>
  </table>
</div></body></html>`;
}

async function sendDossierCard(userId, dossier) {
  try {
    const filepath = await htmlToPng(getDossierHtml(dossier));
    const attachmentId = await uploadImageToZalo(filepath);
    await sendZaloImage(userId, attachmentId);
    console.log('[HoSo] Gửi ảnh thành công');
  } catch (err) {
    console.error('[HoSo] Lỗi card, fallback về text:', err.message);
    await sendZaloText(userId, formatDossierText(dossier));
  }
}

function isDossierCode(text) {
  return /^[A-Z]\d+\.\d+-\d{4,8}-\d+$/i.test(text.trim());
}

module.exports = { searchDossier, extractDossiers, sendDossierCard, isDossierCode };
