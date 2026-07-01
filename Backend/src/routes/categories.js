const router = require('express').Router()
const Category = require('../models/Category')
const ZaloGroupMember = require('../models/ZaloGroupMember')
const requireRole = require('../middleware/requireRole')
const { syncGroupsFromZalo } = require('../services/groupSyncService')

// POST /sync-all — đồng bộ toàn bộ nhóm Zalo → web (superadmin)
router.post('/sync-all', requireRole('superadmin'), async (req, res) => {
  try {
    const result = await syncGroupsFromZalo()
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET / — danh sách tất cả loại phản ánh
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ order: 1 }).lean()
    res.json({ categories })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST / — tạo mới (superadmin)
router.post('/', requireRole('superadmin'), async (req, res) => {
  try {
    const { name, zaloGroupId, icon, order } = req.body
    if (!name || !zaloGroupId) return res.status(400).json({ error: 'Thiếu name hoặc zaloGroupId' })
    const cat = await Category.create({ name, zaloGroupId, icon, order: order ?? 0 })
    res.status(201).json({ category: cat })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /create-zalo-group — tạo nhóm trên Zalo rồi lưu vào DB (superadmin)
router.post('/create-zalo-group', requireRole('superadmin'), async (req, res) => {
  try {
    const { name, icon, order, members } = req.body
    if (!name || !members || members.length === 0) {
      return res.status(400).json({ error: 'Thiếu name hoặc danh sách members' })
    }

    const memberIds = members.map(m => m.userId)
    const { createZaloGroup } = require('../utils/zaloApi')
    const zaloGroupId = await createZaloGroup(name, memberIds)

    const cat = await Category.create({ name, zaloGroupId, icon, order: order ?? 0 })

    for (const m of members) {
      await ZaloGroupMember.create({
        zaloUserId: String(m.userId),
        displayName: m.displayName || 'Người dùng Zalo',
        avatar: m.avatar || '',
        categoryId: cat._id,
        groupId: zaloGroupId,
      }).catch(e => console.error('[ZaloGroupMember] Lỗi insert:', e.message))
    }

    res.status(201).json({ category: cat })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /:id — cập nhật (superadmin)
router.put('/:id', requireRole('superadmin'), async (req, res) => {
  try {
    const { name, zaloGroupId, icon, order } = req.body
    await Category.findByIdAndUpdate(req.params.id, { name, zaloGroupId, icon, order: parseInt(order) || 0 })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /:id — xóa danh mục, giải tán nhóm Zalo thực, và toàn bộ thành viên (superadmin)
router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  try {
    const cat = await Category.findById(req.params.id)
    if (!cat) return res.status(404).json({ error: 'Không tìm thấy nhóm' })

    if (cat.zaloGroupId) {
      try {
        const { deleteZaloGroup } = require('../utils/zaloApi')
        await deleteZaloGroup(cat.zaloGroupId)
      } catch (e) {
        console.warn(`[Category] Bỏ qua lỗi giải tán Zalo Group ${cat.zaloGroupId}:`, e.message)
      }
    }

    await ZaloGroupMember.deleteMany({ categoryId: req.params.id })
    await Category.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
