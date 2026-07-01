const router = require('express').Router()
const Category = require('../models/Category')
const ZaloGroupMember = require('../models/ZaloGroupMember')
const requireRole = require('../middleware/requireRole')
const { syncMembersOfCategory } = require('../services/groupSyncService')
const {
  getPendingGroupMembers,
  acceptGroupJoinRequest,
  rejectGroupJoinRequest,
} = require('../utils/zaloApi')

function normalizePendingMember(m) {
  if (typeof m === 'string') return { id: m, name: '', avatar: '' }
  return {
    id: String(m.id || m.user_id || m.uid || ''),
    name: m.name || m.display_name || m.user_name || '',
    avatar: m.avatar || m.avatar_url || '',
  }
}

// GET /:categoryId — danh sách members của nhóm
router.get('/:categoryId', async (req, res) => {
  try {
    const members = await ZaloGroupMember.find({ categoryId: req.params.categoryId })
      .sort({ displayName: 1 })
      .lean()
    res.json({ members })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /manual/:categoryId — thêm thành viên thủ công (superadmin)
router.post('/manual/:categoryId', requireRole('superadmin'), async (req, res) => {
  try {
    const { displayName, zaloUserId } = req.body
    if (!displayName?.trim() || !zaloUserId?.trim()) {
      return res.status(400).json({ error: 'Cần nhập họ tên và Zalo User ID' })
    }

    const cat = await Category.findById(req.params.categoryId).lean()
    if (!cat) return res.status(404).json({ error: 'Không tìm thấy danh mục' })

    const member = await ZaloGroupMember.findOneAndUpdate(
      { zaloUserId: zaloUserId.trim(), categoryId: cat._id },
      {
        zaloUserId: zaloUserId.trim(),
        displayName: displayName.trim(),
        categoryId: cat._id,
        groupId: cat.zaloGroupId,
        syncedAt: new Date(),
      },
      { upsert: true, new: true }
    )
    res.status(201).json({ ok: true, member })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /sync/:categoryId — đồng bộ thành viên từ Zalo API (superadmin)
router.post('/sync/:categoryId', requireRole('superadmin'), async (req, res) => {
  try {
    const cat = await Category.findById(req.params.categoryId).lean()
    if (!cat) return res.status(404).json({ error: 'Không tìm thấy danh mục' })
    if (!cat.zaloGroupId) return res.status(400).json({ error: 'Danh mục chưa có Group ID' })

    const synced = await syncMembersOfCategory(cat._id, cat.zaloGroupId)
    res.json({ synced })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /member/:memberId — xóa thành viên (superadmin)
router.delete('/member/:memberId', requireRole('superadmin'), async (req, res) => {
  try {
    await ZaloGroupMember.findByIdAndDelete(req.params.memberId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /pending/:categoryId — danh sách người đang chờ duyệt vào nhóm (superadmin)
router.get('/pending/:categoryId', requireRole('superadmin'), async (req, res) => {
  try {
    const cat = await Category.findById(req.params.categoryId).lean()
    if (!cat) return res.status(404).json({ error: 'Không tìm thấy danh mục' })
    if (!cat.zaloGroupId) return res.status(400).json({ error: 'Danh mục chưa có Group ID' })

    const { members, total } = await getPendingGroupMembers(cat.zaloGroupId)
    res.json({ total, members: members.map(normalizePendingMember) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /pending/:categoryId/approve — duyệt thành viên vào nhóm + lưu vào DB (superadmin)
router.post('/pending/:categoryId/approve', requireRole('superadmin'), async (req, res) => {
  try {
    const { users } = req.body // [{ id, name, avatar }]
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'Cần chọn ít nhất 1 người để duyệt' })
    }

    const cat = await Category.findById(req.params.categoryId).lean()
    if (!cat) return res.status(404).json({ error: 'Không tìm thấy danh mục' })
    if (!cat.zaloGroupId) return res.status(400).json({ error: 'Danh mục chưa có Group ID' })

    await acceptGroupJoinRequest(cat.zaloGroupId, users.map((u) => u.id))

    for (const u of users) {
      await ZaloGroupMember.findOneAndUpdate(
        { zaloUserId: String(u.id), categoryId: cat._id },
        {
          zaloUserId: String(u.id),
          displayName: u.name || 'Người dùng Zalo',
          avatar: u.avatar || '',
          categoryId: cat._id,
          groupId: cat.zaloGroupId,
          syncedAt: new Date(),
        },
        { upsert: true }
      )
    }

    res.json({ ok: true, approved: users.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /pending/:categoryId/reject — từ chối thành viên muốn vào nhóm (superadmin)
router.post('/pending/:categoryId/reject', requireRole('superadmin'), async (req, res) => {
  try {
    const { userIds } = req.body // [id, ...]
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Cần chọn ít nhất 1 người để từ chối' })
    }

    const cat = await Category.findById(req.params.categoryId).lean()
    if (!cat) return res.status(404).json({ error: 'Không tìm thấy danh mục' })
    if (!cat.zaloGroupId) return res.status(400).json({ error: 'Danh mục chưa có Group ID' })

    await rejectGroupJoinRequest(cat.zaloGroupId, userIds)
    res.json({ ok: true, rejected: userIds.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
