const { sendZaloText } = require('../utils/zaloApi');
const {
  startFeedback, handleText, handleImage, handleContactCard, isFeedbackTrigger,
} = require('../services/feedbackService');
const { saveProfile } = require('../services/profileCache');
const { searchDossier, extractDossiers, sendDossierCard, isDossierCode } = require('../services/hoSoService');
const { sendWaterOutageCard } = require('../services/catNuocService');
const { sendOutageCard } = require('../services/catDienService');
const { addGroup } = require('../services/groupService');

// Lưu trạng thái hội thoại theo userId (tự xóa sau 10 phút)
const userStates = new Map();

function setState(userId, state) {
  userStates.set(userId, state);
  setTimeout(() => {
    if (userStates.get(userId) === state) userStates.delete(userId);
  }, 10 * 60 * 1000);
}

// Timer 10s cho luồng cắt điện: hết giờ không tra thêm → cảm ơn & kết thúc
const catDienTimers = new Map();

function clearCatDienTimer(userId) {
  const t = catDienTimers.get(userId);
  if (t) { clearTimeout(t); catDienTimers.delete(userId); }
}

function armCatDienTimer(userId) {
  clearCatDienTimer(userId);
  const t = setTimeout(async () => {
    catDienTimers.delete(userId);
    if (userStates.get(userId) === 'catdien_active') {
      userStates.delete(userId);
      try { await sendZaloText(userId, 'Cảm ơn bạn đã dùng tiện ích của chúng tôi! ⚡'); } catch { /* bỏ qua */ }
    }
  }, 30 * 1000);
  catDienTimers.set(userId, t);
}

async function handleHoSoQuery(userId, code) {
  await sendZaloText(userId, `⏳ Đang tra cứu hồ sơ ${code}...`);
  try {
    const data = await searchDossier(code);
    const dossiers = extractDossiers(data);
    if (!dossiers.length) {
      await sendZaloText(userId,
        `❌ Không tìm thấy hồ sơ với mã: ${code}\n\nVui lòng kiểm tra lại mã hồ sơ hoặc liên hệ bộ phận tiếp nhận.`
      );
    } else {
      for (const d of dossiers) await sendDossierCard(userId, d);
    }
  } catch (err) {
    console.error('[IOCTC] Lỗi tra cứu:', err.message);
    await sendZaloText(userId, '⚠️ Hệ thống tra cứu tạm thời gián đoạn. Vui lòng thử lại sau ít phút.');
  }
}

async function handleWebhook(body) {
  const eventName = body.event_name;

  // Tự động lưu nhóm khi có thông tin group
  if (body.group?.id) {
    const groupId = String(body.group.id);
    const groupName = body.group.name || '';
    addGroup({ group_id: groupId, name: groupName })
      .then(() => console.log(`[Group] Auto-saved: ${groupId} "${groupName}"`))
      .catch(err => console.error('[Group] Auto-save error:', err.message));
  }

  if (eventName === 'oa_joined_group') {
    console.log(`[Group] OA được thêm vào nhóm: ${body.group?.id} "${body.group?.name}"`);
    return;
  }

  const userId = body.sender?.id || body.follower?.id;
  if (!userId) return;

  console.log(`[Event] ${eventName} | userId: ${userId}`);

  // Cache profile từ mọi sự kiện có sender info
  const displayName = body.sender?.display_name || body.follower?.display_name || '';
  const avatar = body.sender?.avatar || body.follower?.avatar || '';
  if (displayName) {
    saveProfile(userId, displayName, avatar).catch(() => {});
  }

  // Cập nhật profile khi user thay đổi tên/avatar
  if (eventName === 'update_user_info') {
    if (displayName) {
      console.log(`[Profile] Cập nhật thông tin: ${userId} → "${displayName}"`);
      // Cập nhật luôn vào danh sách followers trong Redis nếu có
      try {
        const { getStoredFollowers } = require('../services/followerService');
        const followers = await getStoredFollowers();
        const idx = followers.findIndex(f => f.user_id === userId);
        if (idx !== -1) {
          followers[idx].display_name = displayName;
          followers[idx].avatar = avatar;
          // Ghi lại vào Redis
          const axios = require('axios');
          const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
          const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
          if (redisUrl && redisToken) {
            await axios.post(redisUrl, ['SET', 'nongson_oa_followers', JSON.stringify(followers)], {
              headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (e) {
        console.warn('[Profile] Không cập nhật được followers list:', e.message);
      }
    }
    return;
  }

  // Chào mừng khi follow OA
  if (eventName === 'follow') {
    await sendZaloText(userId,
      'Xin chào! Chào mừng bạn quan tâm OA UBND Nong Son 🏛️\n\n' +
      'Bạn có thể:\n' +
      '• 📝 Gửi góp ý, phản ánh — chọn "Góp ý" hoặc nhắn #goopy\n' +
      '• 📋 Tra cứu hồ sơ hành chính — nhắn #tracuuhoso\n' +
      '• 💧 Xem lịch cắt nước — nhắn #lichcatnuoc'
    );
    return;
  }

  // Xử lý text và submit_info
  if (eventName === 'user_send_text' || eventName === 'user_submit_info') {
    let text;
    if (eventName === 'user_send_text') {
      // Kiểm tra contact card trong attachment
      const attachments = body.message?.attachments || [];
      const contactAtt = attachments.find(a => a.type === 'contact');
      if (contactAtt) {
        const phone = contactAtt.payload?.phone || contactAtt.payload?.phoneNumber || '';
        const contactName = contactAtt.payload?.name || contactAtt.payload?.display_name || displayName;
        if (phone) {
          await handleContactCard(userId, phone, contactName);
          return;
        }
      }
      text = (body.message?.text || '').trim();
    } else {
      text = (body.info?.action_payload || body.info?.data || body.info?.action || '').trim();
    }

    if (!text) return;

    const state = userStates.get(userId);
    const lower = text.toLowerCase();

    // Huỷ trạng thái
    if (['huỷ', 'huy', 'cancel', 'thoát', 'thoat'].includes(lower)) {
      userStates.delete(userId);
      clearCatDienTimer(userId);
      await sendZaloText(userId, 'Đã huỷ. Bạn có thể chọn lại từ menu bên dưới.');
      return;
    }

    // ── Lịch cắt nước ─────────────────────────────────────
    if (lower.includes('cắt nước') || lower.includes('catnuoc') || lower === '#lichcatnuoc') {
      setState(userId, 'waiting_for_catnuoc_filter');
      await sendZaloText(userId,
        '💧 Tra cứu lịch tạm ngưng cấp nước tại Đà Nẵng.\n\n' +
        'Nhập tên 📍 phường/xã hoặc 📅 ngày để tra cứu.\n' +
        'Ví dụ: Hòa Xuân  hoặc  20/05\n\n' +
        '(Nhắn "tất cả" để xem toàn bộ · Nhắn "huỷ" để thoát)'
      );
      return;
    }

    if (state === 'waiting_for_catnuoc_filter') {
      userStates.delete(userId);
      await sendZaloText(userId, '⏳ Đang tra cứu lịch cắt nước...');
      try {
        await sendWaterOutageCard(userId, text);
      } catch (err) {
        console.error('[CatNuoc] Lỗi:', err.message);
        await sendZaloText(userId, '⚠️ Không thể lấy lịch cắt nước. Vui lòng thử lại sau.');
      }
      return;
    }

    // ── Lịch cắt điện ─────────────────────────────────────
    if (lower.includes('cắt điện') || lower.includes('cúp điện') || lower.includes('mất điện') ||
        lower.includes('ngắt điện') || lower.includes('catdien') || lower === '#lichcatdien') {
      setState(userId, 'catdien_active');
      clearCatDienTimer(userId);
      await sendZaloText(userId,
        '⚡ Tra cứu lịch tạm ngừng cấp điện tại Nong Son.\n\n' +
        'Nhập tên 📍 trạm hoặc 📅 ngày để tra cứu.\n' +
        'Ví dụ: Lộc Đại  hoặc  12/06\n\n' +
        '(Nhắn "tất cả" để xem toàn bộ · Nhắn "huỷ" để thoát)'
      );
      return;
    }

    if (state === 'catdien_active') {
      clearCatDienTimer(userId);
      await sendZaloText(userId, '⏳ Đang tra cứu lịch cắt điện...');
      try {
        await sendOutageCard(userId, text);
      } catch (err) {
        console.error('[CatDien] Lỗi:', err.message);
        await sendZaloText(userId, '⚠️ Không thể lấy lịch cắt điện. Vui lòng thử lại sau.');
      }
      await sendZaloText(userId,
        '✅ Thông tin đã hoàn tất, bạn cần tra cứu thêm không?\n' +
        '(Quá trình sẽ tự động ngắt sau 30 giây)'
      );
      armCatDienTimer(userId);
      return;
    }

    // ── Tra cứu hồ sơ ─────────────────────────────────────
    if (lower.includes('tra cứu') || lower.includes('tracuu') || lower === '#tracuuhoso' || lower.includes('hồ sơ')) {
      setState(userId, 'waiting_for_hoso_code');
      await sendZaloText(userId,
        '📋 Vui lòng nhập mã số hồ sơ cần tra cứu.\n' +
        'VD: H17.00-000000-0000\n\n' +
        '(Nhắn "huỷ" để thoát)'
      );
      return;
    }

    if (state === 'waiting_for_hoso_code') {
      if (isDossierCode(text)) {
        userStates.delete(userId);
        await handleHoSoQuery(userId, text.trim().toUpperCase());
      } else {
        await sendZaloText(userId,
          '❌ Mã hồ sơ không đúng định dạng.\n\n' +
          'Vui lòng nhập đúng định dạng:\nVD: H17.00-000000-0000\n\n' +
          '(Nhắn "huỷ" để thoát)'
        );
      }
      return;
    }

    // Gửi thẳng mã hồ sơ không qua trigger
    if (isDossierCode(text)) {
      await handleHoSoQuery(userId, text.trim().toUpperCase());
      return;
    }

    // ── Góp ý / phản ánh ──────────────────────────────────
    if (isFeedbackTrigger(lower) || lower === '#goopy') {
      await startFeedback(userId, displayName);
      return;
    }

    await handleText(userId, text, displayName);
    return;
  }

  // User gửi ảnh trực tiếp
  if (eventName === 'user_send_image') {
    const attachments = body.message?.attachments || [];
    const imageAtt = attachments.find(a => a.type === 'photo' || a.type === 'image');
    const imageUrl = imageAtt?.payload?.url || imageAtt?.payload?.thumbnail || '';
    if (imageUrl) await handleImage(userId, imageUrl);
    return;
  }
}

module.exports = { handleWebhook };
