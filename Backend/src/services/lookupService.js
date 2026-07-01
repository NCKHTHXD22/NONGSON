const { setState, getState, clearState } = require('./chatState');
const { sendZaloText } = require('../utils/zaloApi');
const Feedback = require('../models/Feedback');

const CODE_RE = /^#?([0-9a-f]{5})$/i;
const MAX_LIST = 5;
const CANCEL_WORDS = ['huỷ', 'hủy', 'huy', 'cancel', 'thoát', 'thoat'];

// Không dùng #tracuuhoso (đã dành cho tra cứu hồ sơ hành chính IOCTC)
function isLookupTrigger(text) {
  const lower = text.toLowerCase().trim();
  return (
    lower === '#tracuugoopy' ||
    lower === '#theodoi' ||
    lower === '#theodoiphananh' ||
    lower.includes('theo dõi phản ánh') ||
    lower.includes('theo doi phan anh') ||
    lower.includes('tra cứu góp ý') ||
    lower.includes('tra cuu gop y') ||
    lower.includes('tra cứu phản ánh') ||
    lower.includes('tra cuu phan anh')
  );
}

function isDirectCode(text) {
  return CODE_RE.test(text.trim());
}

function shortCode(fb) {
  return fb._id.toString().slice(-5).toUpperCase();
}

function isResolved(fb) {
  return fb.status === 'resolved' || fb.status === 'done';
}

function statusLine(fb) {
  return isResolved(fb) ? '✅ Đã xử lý xong' : '🕐 Đang xử lý';
}

function progressBar(fb) {
  const s1 = true;
  const s2 = !!(fb.assignedTo || fb.status === 'draft' || isResolved(fb));
  const s3 = fb.status === 'draft' || isResolved(fb);
  const s4 = isResolved(fb);
  const s5 = isResolved(fb);

  const mark = (done) => done ? '✅' : '⬜';
  const stages = [
    `${mark(s1)} 1. Đã gởi`,
    `${mark(s2)} 2. Đã tiếp nhận`,
    `${mark(s3)} 3. Đang xử lý`,
    `${mark(s4)} 4. Đã duyệt`,
    `${mark(s5)} 5. Đã xử lý`,
  ];

  let current = 1;
  if (s5) current = 5;
  else if (s4) current = 4;
  else if (s3) current = 3;
  else if (s2) current = 2;
  const labels = stages.map((s, i) => i + 1 === current && !s5 ? s + ' ⏳' : s);

  return '📊 TIẾN TRÌNH XỬ LÝ\n' + labels.join('\n');
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function truncate(text, max) {
  const t = (text || '').trim();
  return t.length > max ? t.slice(0, max).trim() + '...' : t;
}

async function startLookup(userId) {
  const items = await Feedback.find({ userId })
    .sort({ createdAt: -1 })
    .limit(MAX_LIST)
    .populate('categoryId', 'name')
    .lean();

  if (items.length === 0) {
    await sendZaloText(userId,
      '📭 Bạn chưa có phản ánh nào được ghi nhận.\n\n' +
      'Chọn "Góp ý, phản ánh" trong menu để gửi mới.'
    );
    return;
  }

  setState(userId, { step: 'lookup_list', items: items.map((i) => i._id.toString()) });

  const lines = items.map((fb, i) =>
    `${i + 1}️⃣ #${shortCode(fb)} · ${formatDate(fb.createdAt)} · ${statusLine(fb)}\n` +
    `   ${truncate(fb.content, 60)}`
  );

  await sendZaloText(userId,
    '📋 Các phản ánh gần đây của bạn:\n\n' +
    lines.join('\n\n') +
    `\n\nNhắn số (1-${items.length}) để xem chi tiết, hoặc nhắn mã (#XXXXX).\n` +
    '(Nhắn "huỷ" để thoát)'
  );
}

async function replyDetail(userId, fb) {
  const catName = fb.categoryId?.name || 'Chưa rõ';
  const locationLine = fb.location?.address ? `📍 Địa chỉ: ${fb.location.address}\n` : '';
  const deadlineLine = (!isResolved(fb) && fb.deadline) ? `⏰ Hạn xử lý: ${formatDate(fb.deadline)}\n` : '';

  let msg =
    `━━━━━━ THÔNG TIN PHẢN ÁNH ━━━━━━\n` +
    `🆔 Mã phản ánh: #${shortCode(fb)}\n` +
    `🗓️ Ngày gửi: ${formatDate(fb.createdAt)}\n` +
    `🏷️ Loại: ${catName}\n` +
    `${locationLine}` +
    `${deadlineLine}` +
    `📝 Nội dung: ${fb.content}\n\n`;

  msg += progressBar(fb);

  if (isResolved(fb)) {
    const reply = fb.finalResponse || fb.response || '';
    if (reply) {
      msg += `\n\n━━━━━━ PHẢN HỒI CỦA UBND ━━━━━━\n${reply}`;
    }
  }

  await sendZaloText(userId, msg);
}

async function lookupByCode(userId, rawCode) {
  const match = rawCode.trim().match(CODE_RE);
  const code = (match ? match[1] : rawCode.replace(/^#/, '')).toUpperCase();

  const candidates = await Feedback.find({ userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('categoryId', 'name')
    .lean();

  const fb = candidates.find((f) => shortCode(f) === code);
  clearState(userId);

  if (!fb) {
    await sendZaloText(userId, `⚠️ Không tìm thấy phản ánh #${code} trong các phản ánh của bạn.`);
    return;
  }
  await replyDetail(userId, fb);
}

async function handleLookupReply(userId, text) {
  const lower = text.toLowerCase().trim();

  if (CANCEL_WORDS.includes(lower)) {
    clearState(userId);
    await sendZaloText(userId, '❌ Đã huỷ tra cứu.');
    return;
  }

  if (isDirectCode(text)) {
    await lookupByCode(userId, text);
    return;
  }

  const state = getState(userId);
  const ids = state?.items || [];
  const idx = parseInt(lower, 10) - 1;

  if (Number.isInteger(idx) && idx >= 0 && ids[idx]) {
    const fb = await Feedback.findById(ids[idx]).populate('categoryId', 'name').lean();
    clearState(userId);
    if (fb) await replyDetail(userId, fb);
    return;
  }

  await sendZaloText(userId, `⚠️ Vui lòng nhắn số (1-${ids.length}) hoặc mã phản ánh (#XXXXX).`);
}

module.exports = { isLookupTrigger, isDirectCode, startLookup, handleLookupReply, lookupByCode };
