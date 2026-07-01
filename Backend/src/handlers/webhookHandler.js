const { sendZaloText } = require('../utils/zaloApi');
const {
  startFeedback, handleText, handleImage, handleContactCard, handleLocation, isFeedbackTrigger,
} = require('../services/feedbackService');
const { getState: getChatState } = require('../services/chatState');
const {
  isLookupTrigger, isDirectCode, startLookup, handleLookupReply, lookupByCode,
} = require('../services/lookupService');
const { saveProfile } = require('../services/profileCache');
const { searchDossier, extractDossiers, sendDossierCard, isDossierCode } = require('../services/hoSoService');
const { sendWaterOutageCard } = require('../services/catNuocService');
const { sendOutageCard } = require('../services/catDienService');
const { addGroup } = require('../services/groupService');

// Trạng thái cục bộ cho luồng IOCTC / cắt nước / cắt điện (không dùng chatState)
const localStates = new Map();

function setLocalState(userId, state) {
  localStates.set(userId, state);
  setTimeout(() => {
    if (localStates.get(userId) === state) localStates.delete(userId);
  }, 10 * 60 * 1000);
}

const catDienTimers = new Map();

function clearCatDienTimer(userId) {
  const t = catDienTimers.get(userId);
  if (t) { clearTimeout(t); catDienTimers.delete(userId); }
}

function armCatDienTimer(userId) {
  clearCatDienTimer(userId);
  const t = setTimeout(async () => {
    catDienTimers.delete(userId);
    if (localStates.get(userId) === 'catdien_active') {
      localStates.delete(userId);
      try { await sendZaloText(userId, 'Cảm ơn bạn đã dùng tiện ích của chúng tôi! ⚡'); } catch { }
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

  // Tạo/xoá nhóm → đồng bộ lại danh sách nhóm
  if (['create_group', 'delete_group'].includes(eventName)) {
    console.log(`[GroupSync] Webhook ${eventName} (group ${body.group?.id || body.group_id}) → lên lịch đồng bộ`);
    require('../services/groupSyncService').scheduleSyncDebounced();
    return;
  }

  // Thành viên ra/vào nhóm
  if (['user_join_group', 'user_leave_group'].includes(eventName)) {
    const groupId = body.group?.id || body.group_id;
    const users = body.users || [];
    if (!users.length) {
      const fallbackId = body.sender?.id || body.follower?.id || body.user?.id;
      if (fallbackId) users.push({ id: fallbackId });
    }
    console.log(`[GroupSync] Webhook ${eventName}: groupId=${groupId}, ${users.length} user`);
    if (groupId && users.length > 0) {
      const { handleUserJoinGroup, handleUserLeaveGroup } = require('../services/groupSyncService');
      for (const u of users) {
        const uid = u.id;
        if (!uid) continue;
        if (eventName === 'user_join_group') {
          handleUserJoinGroup(groupId, uid, '', '').catch(e => console.error(e));
        } else {
          handleUserLeaveGroup(groupId, uid).catch(e => console.error(e));
        }
      }
    }
    return;
  }

  const userId = body.sender?.id || body.follower?.id;
  if (!userId) return;

  console.log(`[Event] ${eventName} | userId: ${userId}`);

  const displayName = body.sender?.display_name || body.follower?.display_name || '';
  const avatar = body.sender?.avatar || body.follower?.avatar || '';
  if (displayName) {
    saveProfile(userId, displayName, avatar).catch(() => {});
  }

  if (eventName === 'update_user_info') {
    if (displayName) {
      console.log(`[Profile] Cập nhật thông tin: ${userId} → "${displayName}"`);
      try {
        const { getStoredFollowers } = require('../services/followerService');
        const followers = await getStoredFollowers();
        const idx = followers.findIndex(f => f.user_id === userId);
        if (idx !== -1) {
          followers[idx].display_name = displayName;
          followers[idx].avatar = avatar;
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

  if (eventName === 'follow') {
    await sendZaloText(userId,
      'Xin chào! Chào mừng bạn quan tâm OA UBND xã Nông Sơn 🏛️\n\n' +
      'Bạn có thể:\n' +
      '• 📝 Gửi góp ý, phản ánh — chọn "Góp ý" hoặc nhắn #goopy\n' +
      '• 🔍 Theo dõi phản ánh đã gửi — nhắn #theodoi\n' +
      '• 📋 Tra cứu hồ sơ hành chính — nhắn #tracuuhoso\n' +
      '• 💧 Xem lịch cắt nước — nhắn #lichcatnuoc'
    );
    return;
  }

  // ── User gửi text ──────────────────────────────────────────────────────────
  if (eventName === 'user_send_text') {
    const attachments = body.message?.attachments || [];

    // Contact card
    const contactAtt = attachments.find(a => a.type === 'contact');
    if (contactAtt) {
      const phone = contactAtt.payload?.phone || contactAtt.payload?.phoneNumber || '';
      const contactName = contactAtt.payload?.name || contactAtt.payload?.display_name || displayName;
      if (phone) {
        await handleContactCard(userId, phone, contactName);
        return;
      }
    }

    // Location attachment trong text event
    const locationAtt = attachments.find(a => a.type === 'location');
    if (locationAtt) {
      const p = locationAtt.payload || {};
      const lat = p.lat ?? p.latitude;
      const lng = p.long ?? p.lng ?? p.longitude;
      const address = p.address || p.name || '';
      if (lat != null && lng != null) {
        await handleLocation(userId, { lat: Number(lat), lng: Number(lng), address });
        return;
      }
    }

    const text = (body.message?.text || '').trim();
    if (!text) return;

    const lower = text.toLowerCase().trim();
    const chatState = getChatState(userId);

    // Nếu đang trong luồng tra cứu phản ánh
    if (chatState?.step === 'lookup_list') {
      await handleLookupReply(userId, text);
      return;
    }

    // Nếu đang trong luồng góp ý (feedbackService quản lý state nội bộ)
    if (chatState) {
      await handleText(userId, text, displayName);
      return;
    }

    // Không có chatState: kiểm tra local state và trigger
    const localState = localStates.get(userId);

    // Huỷ local state (IOCTC / cắt nước / cắt điện)
    if (['huỷ', 'hủy', 'huy', 'cancel', 'thoát', 'thoat'].includes(lower)) {
      localStates.delete(userId);
      clearCatDienTimer(userId);
      await sendZaloText(userId, 'Đã huỷ. Bạn có thể chọn lại từ menu bên dưới.');
      return;
    }

    // ── Đang trong luồng cắt nước ──
    if (localState === 'waiting_for_catnuoc_filter') {
      localStates.delete(userId);
      await sendZaloText(userId, '⏳ Đang tra cứu lịch cắt nước...');
      try { await sendWaterOutageCard(userId, text); }
      catch (err) { await sendZaloText(userId, '⚠️ Không thể lấy lịch cắt nước. Vui lòng thử lại sau.'); }
      return;
    }

    // ── Đang trong luồng cắt điện ──
    if (localState === 'catdien_active') {
      clearCatDienTimer(userId);
      await sendZaloText(userId, '⏳ Đang tra cứu lịch cắt điện...');
      try { await sendOutageCard(userId, text); }
      catch (err) { await sendZaloText(userId, '⚠️ Không thể lấy lịch cắt điện. Vui lòng thử lại sau.'); }
      await sendZaloText(userId, '✅ Thông tin đã hoàn tất, bạn cần tra cứu thêm không?\n(Quá trình sẽ tự động ngắt sau 30 giây)');
      armCatDienTimer(userId);
      return;
    }

    // ── Đang trong luồng tra cứu hồ sơ hành chính ──
    if (localState === 'waiting_for_hoso_code') {
      if (isDossierCode(text)) {
        localStates.delete(userId);
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

    // ── Trigger: Lịch cắt nước ──
    if (lower.includes('cắt nước') || lower.includes('catnuoc') || lower === '#lichcatnuoc') {
      setLocalState(userId, 'waiting_for_catnuoc_filter');
      await sendZaloText(userId,
        '💧 Tra cứu lịch tạm ngưng cấp nước tại Đà Nẵng.\n\n' +
        'Nhập tên 📍 phường/xã hoặc 📅 ngày để tra cứu.\n' +
        'Ví dụ: Hòa Xuân  hoặc  20/05\n\n' +
        '(Nhắn "tất cả" để xem toàn bộ · Nhắn "huỷ" để thoát)'
      );
      return;
    }

    // ── Trigger: Lịch cắt điện ──
    if (lower.includes('cắt điện') || lower.includes('cúp điện') || lower.includes('mất điện') ||
        lower.includes('ngắt điện') || lower.includes('catdien') || lower === '#lichcatdien') {
      setLocalState(userId, 'catdien_active');
      clearCatDienTimer(userId);
      await sendZaloText(userId,
        '⚡ Tra cứu lịch tạm ngừng cấp điện tại Nông Sơn.\n\n' +
        'Nhập tên 📍 trạm hoặc 📅 ngày để tra cứu.\n' +
        'Ví dụ: Lộc Đại  hoặc  12/06\n\n' +
        '(Nhắn "tất cả" để xem toàn bộ · Nhắn "huỷ" để thoát)'
      );
      return;
    }

    // ── Trigger: Tra cứu hồ sơ hành chính (IOCTC) ──
    if (lower.includes('tra cứu hồ sơ') || lower.includes('tra cuu ho so') || lower === '#tracuuhoso') {
      setLocalState(userId, 'waiting_for_hoso_code');
      await sendZaloText(userId,
        '📋 Vui lòng nhập mã số hồ sơ cần tra cứu.\n' +
        'VD: H17.00-000000-0000\n\n' +
        '(Nhắn "huỷ" để thoát)'
      );
      return;
    }

    // Gửi thẳng mã hồ sơ hành chính
    if (isDossierCode(text)) {
      await handleHoSoQuery(userId, text.trim().toUpperCase());
      return;
    }

    // ── Trigger: Theo dõi / tra cứu phản ánh góp ý ──
    if (isLookupTrigger(lower)) {
      await startLookup(userId);
      return;
    }

    // Mã phản ánh ngắn (#XXXXX — 5 ký tự hex)
    if (isDirectCode(text)) {
      await lookupByCode(userId, text);
      return;
    }

    // ── Trigger: Góp ý / phản ánh ──
    if (isFeedbackTrigger(lower) || lower === '#goopy') {
      await startFeedback(userId, displayName);
      return;
    }

    await handleText(userId, text, displayName);
    return;
  }

  // ── User click menu (submit_info) ─────────────────────────────────────────
  if (eventName === 'user_submit_info') {
    const action = (body.info?.action_payload || body.info?.action || body.info?.data || '').trim();
    if (!action) return;
    const actionLower = action.toLowerCase();

    if (isLookupTrigger(actionLower)) {
      await startLookup(userId);
      return;
    }
    if (isFeedbackTrigger(actionLower) || actionLower === '#goopy') {
      await startFeedback(userId, displayName);
    }
    return;
  }

  // ── User gửi ảnh ──────────────────────────────────────────────────────────
  if (eventName === 'user_send_image') {
    const attachments = body.message?.attachments || [];
    const imageAtt = attachments.find(a => a.type === 'photo' || a.type === 'image');
    const imageUrl = imageAtt?.payload?.url || imageAtt?.payload?.thumbnail || '';
    if (imageUrl) await handleImage(userId, imageUrl);
    return;
  }

  // ── User chia sẻ vị trí GPS ───────────────────────────────────────────────
  if (eventName === 'user_send_location') {
    const loc = body.message?.location || body.message?.attachments?.[0]?.payload || {};
    const lat = loc.lat ?? loc.latitude;
    const lng = loc.long ?? loc.lng ?? loc.longitude;
    const address = loc.address || loc.name || '';
    if (lat != null && lng != null) {
      await handleLocation(userId, { lat: Number(lat), lng: Number(lng), address });
    }
    return;
  }
}

module.exports = { handleWebhook };
