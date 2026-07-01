const Category = require('../models/Category');
const ZaloGroupMember = require('../models/ZaloGroupMember');
const { getGroupsOfOA, getGroupMembersV3 } = require('../utils/zaloApi');

const DEFAULT_ICON = '👥';
const SYNC_INTERVAL_MS = 30 * 60 * 1000;

async function syncMembersOfCategory(categoryId, groupId) {
  try {
    const res = await getGroupMembersV3(groupId);
    if (!res || !res.members) return 0;

    await ZaloGroupMember.deleteMany({ categoryId });

    let count = 0;
    for (const m of res.members) {
      if (m.oa_id) continue;
      await ZaloGroupMember.create({
        zaloUserId: String(m.user_id),
        displayName: m.name || 'Người dùng Zalo',
        avatar: m.avatar || '',
        categoryId: categoryId,
        groupId: String(groupId),
        syncedAt: new Date(),
      });
      count++;
    }
    return count;
  } catch (err) {
    console.error('[GroupSync] Lỗi syncMembersOfCategory:', err.message);
    return 0;
  }
}

async function handleUserJoinGroup(groupId, userId, displayName, avatar) {
  try {
    const cat = await Category.findOne({ zaloGroupId: String(groupId) });
    if (!cat) return;

    let finalName = displayName;
    let finalAvatar = avatar;
    if (!finalName) {
      const { getZaloUserProfile } = require('../utils/zaloApi');
      const profile = await getZaloUserProfile(userId);
      if (profile) {
        finalName = profile.display_name;
        finalAvatar = profile.avatar;
      }
    }

    await ZaloGroupMember.findOneAndUpdate(
      { zaloUserId: String(userId), categoryId: cat._id },
      {
        zaloUserId: String(userId),
        displayName: finalName || 'Người dùng Zalo',
        avatar: finalAvatar || '',
        categoryId: cat._id,
        groupId: String(groupId),
        syncedAt: new Date(),
      },
      { upsert: true }
    );
    console.log(`[GroupSync] Đã thêm thành viên ${userId} vào nhóm ${groupId}`);
  } catch (err) {
    console.error('[GroupSync] Lỗi thêm thành viên qua webhook:', err.message);
  }
}

async function handleUserLeaveGroup(groupId, userId) {
  try {
    const cat = await Category.findOne({ zaloGroupId: String(groupId) });
    if (!cat) return;
    await ZaloGroupMember.deleteOne({ zaloUserId: String(userId), categoryId: cat._id });
    console.log(`[GroupSync] Đã xóa thành viên ${userId} khỏi nhóm ${groupId}`);
  } catch (err) {
    console.error('[GroupSync] Lỗi xóa thành viên qua webhook:', err.message);
  }
}

async function syncGroupsFromZalo() {
  const raw = await getGroupsOfOA();
  if (raw?.error !== 0) {
    throw new Error(`getGroupsOfOA error ${raw?.error}: ${raw?.message}`);
  }
  const groups = raw?.data?.groups || [];
  const realIds = new Set(groups.map(g => String(g.group_id)));

  const cats = await Category.find({}).lean();
  let nextOrder = cats.reduce((m, c) => Math.max(m, c.order || 0), 0) + 1;

  let created = 0, updated = 0, repaired = 0, membersSynced = 0;

  for (const g of groups) {
    const gid = String(g.group_id);
    const name = g.name || '';
    let cat = cats.find(c => String(c.zaloGroupId) === gid);

    if (cat) {
      if (name && cat.name !== name) {
        await Category.findByIdAndUpdate(cat._id, { name });
        updated++;
      }
    } else {
      const stale = cats.find(c => c.name === name && !realIds.has(String(c.zaloGroupId)));
      if (stale) {
        await Category.findByIdAndUpdate(stale._id, { zaloGroupId: gid });
        cat = { ...stale, zaloGroupId: gid };
        repaired++;
      } else {
        cat = await Category.create({ name, zaloGroupId: gid, icon: DEFAULT_ICON, order: nextOrder++ });
        created++;
      }
    }

    const syncedCount = await syncMembersOfCategory(cat._id, gid);
    membersSynced += syncedCount;
  }

  console.log(`[GroupSync] Xong: +${created} mới, ~${updated} đổi tên, ⟳${repaired} sửa ID / ${groups.length} nhóm. Tổng thành viên: ${membersSynced}`);
  return { total: groups.length, created, updated, repaired, membersSynced };
}

let _pending = null;
function scheduleSyncDebounced(delay = 8000) {
  if (_pending) return;
  _pending = setTimeout(() => {
    _pending = null;
    syncGroupsFromZalo().catch(err => console.error('[GroupSync] debounced lỗi:', err.message));
  }, delay);
}

function startGroupSyncSchedule() {
  setInterval(() => {
    syncGroupsFromZalo().catch(err => console.error('[GroupSync] định kỳ lỗi:', err.message));
  }, SYNC_INTERVAL_MS);
  console.log(`[GroupSync] Tự động đồng bộ nhóm mỗi ${SYNC_INTERVAL_MS / 60000} phút`);
}

module.exports = {
  syncGroupsFromZalo,
  syncMembersOfCategory,
  scheduleSyncDebounced,
  handleUserJoinGroup,
  handleUserLeaveGroup,
  startGroupSyncSchedule,
};
