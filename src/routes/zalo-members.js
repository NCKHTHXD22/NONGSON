const router = require('express').Router()
const Category = require('../models/Category')
const ZaloGroupMember = require('../models/ZaloGroupMember')
const requireRole = require('../middleware/requireRole')
const { getZaloGroupMembers } = require('../utils/zaloApi')

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

    const { members, raw } = await getZaloGroupMembers(cat.zaloGroupId)
    if (!members.length) {
      return res.json({ synced: 0, message: 'Không lấy được thành viên từ Zalo', raw })
    }

    let synced = 0
    for (const m of members) {
      const userId = m.user_id || m.id
      if (!userId) continue
      await ZaloGroupMember.findOneAndUpdate(
        { zaloUserId: String(userId), categoryId: cat._id },
        {
          zaloUserId: String(userId),
          displayName: m.display_name || m.name || '',
          avatar: m.avatar || '',
          categoryId: cat._id,
          groupId: cat.zaloGroupId,
          syncedAt: new Date(),
        },
        { upsert: true }
      )
      synced++
    }

    res.json({ synced, total: members.length })
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

module.exports = router
