const { sendZaloText, sendZaloToGroup, getZaloUserProfile } = require('../utils/zaloApi');
const { uploadFromUrl, uploadFromZaloImageUrl } = require('../utils/cloudinary');
const Feedback = require('../models/Feedback');
const Category = require('../models/Category');

const MAX_IMAGES = 5;
const BATCH_DELAY_MS = 3000; // Chờ 3s để gộp ảnh gửi cùng lúc (Zalo có thể giao event chậm)

// State machine lưu trạng thái từng user trong memory (10 phút timeout)
const userStates = new Map();

// Buffer gộp ảnh: { userId → { urls: [], timer } }
const imageBatchBuffer = new Map();

function setState(userId, data) {
  userStates.set(userId, { ...data, ts: Date.now() });
  setTimeout(() => {
    const cur = userStates.get(userId);
    if (cur && cur.ts === userStates.get(userId)?.ts) userStates.delete(userId);
  }, 10 * 60 * 1000);
}

function getState(userId) {
  return userStates.get(userId) || null;
}

function clearState(userId) {
  userStates.delete(userId);
}

function isPhone(text) {
  return /^(0|\+84)[3-9]\d{8}$/.test(text.replace(/\s/g, ''));
}

function isEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

function isUrl(text) {
  return /^https?:\/\/.+/i.test(text.trim());
}

// Bắt đầu luồng góp ý
async function startFeedback(userId, displayName = '') {
  // Nếu webhook không trả display_name → chủ động gọi API lấy tên ngay
  let name = displayName;
  if (!name) {
    const profile = await getZaloUserProfile(userId);
    name = profile?.display_name || '';
    console.log(`[startFeedback] userId=${userId} profile=${JSON.stringify(profile)} → name="${name}"`);
  }
  setState(userId, { step: 'waiting_contact', displayName: name });
  await sendZaloText(userId,
    '💬 Chào mừng bạn đến với tính năng Góp ý - Phản ánh của UBND Nong Son!\n\n' +
    '📞 Vui lòng nhập SĐT (09xxxxxxxx) hoặc email của bạn để chúng tôi có thể liên hệ lại:\n\n' +
    '(Nhắn "huỷ" để thoát bất cứ lúc nào)'
  );
}

async function sendCategoryMenu(userId) {
  await sendZaloText(userId,
    '🏷️ Chọn loại phản ánh của bạn:\n\n' +
    '1️⃣ Môi trường, Hạ tầng, Xây dựng\n' +
    '2️⃣ Văn hoá, Giáo dục, Y tế\n' +
    '3️⃣ Dịch vụ công, Thủ tục hành chính\n' +
    '4️⃣ An ninh trật tự, PCCC\n\n' +
    '(Gõ số 1-4 để chọn)'
  );
}

async function sendImagePrompt(userId, currentCount) {
  if (currentCount === 0) {
    await sendZaloText(userId,
      `📎 Bạn có muốn gửi hình ảnh minh hoạ không? (Tối đa ${MAX_IMAGES} ảnh)\n\n` +
      '• Gửi 1 hoặc nhiều ảnh cùng lúc từ điện thoại\n' +
      '• Hoặc gửi URL ảnh (http/https)\n\n' +
      '1️⃣ Không có hình ảnh — gõ số 1 để bỏ qua'
    );
  } else {
    await sendZaloText(userId,
      `✅ Đã có ${currentCount}/${MAX_IMAGES} ảnh\n\n` +
      `${currentCount < MAX_IMAGES ? '• Gửi thêm ảnh (có thể gửi nhiều cùng lúc)\n' : ''}` +
      '• Nhắn "xong" để tiếp tục\n' +
      '1️⃣ Gõ số 1 để kết thúc phần ảnh'
    );
  }
}

// Xử lý tin nhắn text từ user
async function handleText(userId, text, displayName) {
  const state = getState(userId);

  const lower = text.toLowerCase().trim().normalize('NFC');

  // Lệnh huỷ toàn cục
  if (['huỷ', 'hủy', 'huy', 'cancel', 'thoát', 'thoat'].includes(lower)) {
    clearState(userId);
    await sendZaloText(userId, '❌ Đã huỷ. Bạn có thể bắt đầu lại bằng cách chọn "Góp ý, phản ánh" trong menu.');
    return;
  }

  if (!state) {
    if (isFeedbackTrigger(text)) await startFeedback(userId);
    return;
  }

  if (state.step === 'waiting_contact') {
    if (!isPhone(text) && !isEmail(text)) {
      await sendZaloText(userId,
        '⚠️ Thông tin liên hệ không hợp lệ.\n\n' +
        'Vui lòng nhập:\n• SĐT: 10 chữ số (VD: 0912345678)\n• Email: vd@gmail.com\n\n' +
        '(Nhắn "huỷ" để thoát)'
      );
      return;
    }
    setState(userId, {
      step: 'waiting_category',
      contact: text.trim(),
      displayName: displayName || state.displayName || '',
    });
    await sendCategoryMenu(userId);
    return;
  }

  if (state.step === 'waiting_category') {
    const num = lower.trim();
    const validChoices = ['1', '2', '3', '4'];
    if (!validChoices.includes(num)) {
      await sendZaloText(userId, '⚠️ Vui lòng gõ số từ 1 đến 4 để chọn loại phản ánh.');
      await sendCategoryMenu(userId);
      return;
    }
    const categories = await Category.find({}).sort({ order: 1 }).lean();
    const idx = parseInt(num) - 1;
    if (!categories[idx]) {
      await sendZaloText(userId, '⚠️ Danh mục chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
      return;
    }
    const cat = categories[idx];
    setState(userId, {
      ...state,
      step: 'waiting_content',
      categoryId: cat._id.toString(),
      categoryName: cat.name,
      categoryGroupId: cat.zaloGroupId,
    });
    await sendZaloText(userId,
      `✅ Loại phản ánh: ${cat.name}\n\n` +
      '✏️ Nhập nội dung góp ý / phản ánh của bạn (tối thiểu 5 ký tự):\n\n' +
      '(Nhắn "huỷ" để thoát)'
    );
    return;
  }

  if (state.step === 'waiting_content') {
    if (text.trim().length < 5) {
      await sendZaloText(userId, '⚠️ Nội dung quá ngắn. Vui lòng nhập ít nhất 5 ký tự.');
      return;
    }
    const newState = { ...state, step: 'waiting_image', content: text.trim(), imageUrls: [] };
    setState(userId, newState);
    await sendImagePrompt(userId, 0);
    return;
  }

  if (state.step === 'waiting_image') {
    const currentImages = state.imageUrls || [];
    const doneKeywords = ['1', 'xong', 'done', 'không có', 'khong co', 'không', 'khong', 'no', 'bỏ qua', 'bo qua'];
    const isDone = doneKeywords.some((k) => lower.trim() === k);

    if (isDone) {
      setState(userId, { ...state, step: 'waiting_confirm' });
      await sendConfirmation(userId, state);
      return;
    }

    if (isUrl(text)) {
      if (currentImages.length >= MAX_IMAGES) {
        setState(userId, { ...state, step: 'waiting_confirm' });
        await sendZaloText(userId, `⚠️ Đã đạt tối đa ${MAX_IMAGES} ảnh.`);
        await sendConfirmation(userId, state);
        return;
      }
      await sendZaloText(userId, '⏳ Đang tải ảnh lên...');
      try {
        const imageUrl = await uploadFromUrl(text.trim());
        const newImages = [...currentImages, imageUrl];
        const updatedState = { ...state, imageUrls: newImages };
        setState(userId, updatedState);
        if (newImages.length >= MAX_IMAGES) {
          setState(userId, { ...updatedState, step: 'waiting_confirm' });
          await sendZaloText(userId, `✅ Đã thêm ảnh ${newImages.length}/${MAX_IMAGES}. Đã đạt tối đa.`);
          await sendConfirmation(userId, updatedState);
        } else {
          await sendImagePrompt(userId, newImages.length);
        }
      } catch (err) {
        console.error('[Cloudinary] Upload URL thất bại:', err.message);
        await sendZaloText(userId, '⚠️ Không thể tải ảnh từ URL đó. Hãy thử URL khác hoặc nhắn "xong" để bỏ qua.');
      }
      return;
    }

    await sendImagePrompt(userId, currentImages.length);
    return;
  }

  if (state.step === 'waiting_confirm') {
    if (lower.trim() === '1' || ['xác nhận gửi', 'xac nhan gui', 'xác nhận', 'xac nhan', 'gửi', 'gui', 'ok', 'đồng ý', 'dong y'].some(k => lower.includes(k.normalize('NFC')))) {
      await saveFeedback(userId, state);
      return;
    }
    if (lower.trim() === '2' || ['nhập lại', 'nhap lai', 'làm lại', 'lam lai', 'sửa', 'sua'].some(k => lower.includes(k.normalize('NFC')))) {
      await startFeedback(userId);
      return;
    }
    if (lower.trim() === '3' || ['huỷ', 'hủy', 'huy', 'cancel'].some(k => lower.includes(k.normalize('NFC')))) {
      clearState(userId);
      await sendZaloText(userId, '❌ Đã huỷ. Bạn có thể bắt đầu lại bằng cách chọn "Góp ý, phản ánh" trong menu.');
      return;
    }
    await sendZaloText(userId,
      '⚠️ Vui lòng trả lời bằng số:\n1️⃣ Xác nhận gửi\n2️⃣ Nhập lại\n3️⃣ Huỷ'
    );
    return;
  }
}

// Xử lý khi user gửi ảnh trực tiếp — gộp ảnh gửi cùng lúc qua debounce
async function handleImage(userId, imageUrl) {
  const state = getState(userId);
  if (!state || state.step !== 'waiting_image') return;

  // Thêm URL vào buffer và đặt lại timer
  const existing = imageBatchBuffer.get(userId) || { urls: [], timer: null };
  existing.urls.push(imageUrl);
  if (existing.timer) clearTimeout(existing.timer);
  existing.timer = setTimeout(() => _processBatch(userId), BATCH_DELAY_MS);
  imageBatchBuffer.set(userId, existing);
}

// Xử lý batch ảnh sau khi hết thời gian chờ
async function _processBatch(userId) {
  const batch = imageBatchBuffer.get(userId);
  imageBatchBuffer.delete(userId);
  if (!batch || batch.urls.length === 0) return;

  const state = getState(userId);
  if (!state || state.step !== 'waiting_image') return;

  const currentImages = state.imageUrls || [];

  // Nếu đã đủ ảnh trước đó
  if (currentImages.length >= MAX_IMAGES) {
    setState(userId, { ...state, step: 'waiting_confirm' });
    await sendConfirmation(userId, state);
    return;
  }

  const remaining = MAX_IMAGES - currentImages.length;
  const toProcess = batch.urls.slice(0, remaining);
  const skipped = batch.urls.length - toProcess.length;

  await sendZaloText(userId, `⏳ Đang tải ${toProcess.length} ảnh lên...`);

  // Upload song song tất cả ảnh trong batch
  const results = await Promise.allSettled(
    toProcess.map((url) => uploadFromZaloImageUrl(url))
  );

  const uploaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.filter((r) => r.status === 'rejected').length;

  // Đọc lại state mới nhất sau khi await upload xong để tránh race condition
  // (nhiều batch chạy song song sẽ ghi đè lẫn nhau nếu dùng currentImages cũ)
  const freshState = getState(userId);
  if (!freshState || freshState.step !== 'waiting_image') return;
  const freshImages = freshState.imageUrls || [];
  const available = MAX_IMAGES - freshImages.length;
  const finalUploaded = uploaded.slice(0, Math.max(0, available));
  const newImages = [...freshImages, ...finalUploaded];
  const updatedState = { ...freshState, imageUrls: newImages };

  let msg = `✅ Đã thêm ${uploaded.length} ảnh (${newImages.length}/${MAX_IMAGES})`;
  if (failed > 0) msg += ` · ${failed} ảnh lỗi, vui lòng thử lại`;
  if (skipped > 0) msg += ` · ${skipped} ảnh bị bỏ qua (đã đủ tối đa)`;

  if (newImages.length >= MAX_IMAGES) {
    setState(userId, { ...updatedState, step: 'waiting_confirm' });
    await sendZaloText(userId, msg + '. Đã đạt tối đa.');
    await sendConfirmation(userId, updatedState);
  } else {
    setState(userId, updatedState);
    await sendZaloText(userId, msg + `\n\nGửi thêm ảnh hoặc nhắn "xong" để tiếp tục.`);
  }
}

// Xử lý khi user gửi contact card
async function handleContactCard(userId, phone, displayName) {
  const state = getState(userId);
  if (!state || state.step !== 'waiting_contact') return;

  setState(userId, { step: 'waiting_category', contact: phone, displayName: displayName || '' });
  await sendZaloText(userId, `✅ Đã ghi nhận SĐT: ${phone}\n`);
  await sendCategoryMenu(userId);
}

async function sendConfirmation(userId, state) {
  const imageUrls = state.imageUrls || [];
  const imageStatus = imageUrls.length > 0
    ? `✅ ${imageUrls.length} ảnh đính kèm`
    : '❌ Không có ảnh';
  await sendZaloText(userId,
    '📋 Xác nhận góp ý:\n' +
    `• Liên hệ: ${state.contact}\n` +
    `• Loại: ${state.categoryName || 'Chưa chọn'}\n` +
    `• Nội dung: ${state.content}\n` +
    `• Hình ảnh: ${imageStatus}\n\n` +
    'Trả lời bằng số:\n' +
    '1️⃣ Xác nhận gửi\n' +
    '2️⃣ Nhập lại\n' +
    '3️⃣ Huỷ'
  );
}

async function saveFeedback(userId, state) {
  try {
    let displayName = state.displayName || '';
    if (!displayName) {
      const profile = await getZaloUserProfile(userId);
      displayName = profile?.display_name || '';
      console.log(`[saveFeedback] getZaloUserProfile userId=${userId} → profile=${JSON.stringify(profile)} displayName="${displayName}"`);
    }

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);

    const imageUrls = state.imageUrls || [];
    const feedback = await Feedback.create({
      userId,
      displayName,
      contact: state.contact,
      content: state.content,
      imageUrl: imageUrls[0] || '',
      imageUrls,
      categoryId: state.categoryId || null,
      deadline,
    });
    clearState(userId);

    const shortCode = feedback._id.toString().slice(-5).toUpperCase();

    await sendZaloText(userId,
      '✅ Đã tiếp nhận phản ánh!\n\n' +
      `Mã phản ánh: #${shortCode}\n` +
      'UBND Nong Son sẽ xử lý\n' +
      'trong 2-3 ngày làm việc kể từ\n' +
      'ngày tiếp nhận. Cảm ơn bạn!'
    );

    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const nameInfo = displayName ? `👤 Tên: ${displayName}\n` : '';
    const catInfo = state.categoryName ? `🏷️ Loại: ${state.categoryName}\n` : '';
    const imageInfo = imageUrls.length > 0
      ? `🖼️ ${imageUrls.length} ảnh:\n${imageUrls.map((u, i) => `  ${i + 1}. ${u}`).join('\n')}`
      : '🖼️ Ảnh: Không có';

    const groupMsg =
      `📩 PHẢN ÁNH MỚI - ${now}\n` +
      `${'─'.repeat(30)}\n` +
      `${nameInfo}` +
      `📞 Liên hệ: ${state.contact}\n` +
      `${catInfo}` +
      `📝 Nội dung:\n${state.content}\n` +
      `${imageInfo}\n` +
      `🆔 Mã: #${shortCode}`;

    const targetGroupId = state.categoryGroupId;
    await sendZaloToGroup(groupMsg, targetGroupId);

    console.log(`[Feedback] Lưu góp ý userId=${userId} contact=${state.contact} category=${state.categoryName} images=${imageUrls.length}`);
  } catch (err) {
    console.error('[Feedback] Lưu DB thất bại:', err.message);
    await sendZaloText(userId, '⚠️ Có lỗi xảy ra khi lưu góp ý. Vui lòng thử lại sau.');
  }
}

function isFeedbackTrigger(text) {
  const lower = text.toLowerCase();
  return (
    lower.includes('#goopy') ||
    lower.includes('góp ý') ||
    lower.includes('gop y') ||
    lower.includes('phản ánh') ||
    lower.includes('phan anh') ||
    lower === 'goopy'
  );
}

module.exports = { startFeedback, handleText, handleImage, handleContactCard, isFeedbackTrigger };
