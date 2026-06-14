const router = require('express').Router()
const Feedback = require('../models/Feedback')
const AdminUser = require('../models/AdminUser')
const Category = require('../models/Category')
const requireRole = require('../middleware/requireRole')
const { sendZaloText, sendZaloToGroup } = require('../utils/zaloApi')
const { getProfiles } = require('../services/profileCache')

const LEADER_ROLES = ['superadmin', 'dept_leader']

// GET / — danh sách
router.get('/', async (req, res) => {
  try {
    const { status, assignedTo, categoryId, q, page = 1 } = req.query
    const limit = 20
    const skip = (parseInt(page) - 1) * limit
    const filter = {}

    // Lọc theo quyền: officer chỉ thấy phản ánh được phân công cho mình
    const me = req.user
    if (me.role === 'officer') {
      filter.assignedTo = me.id
    } else if (me.role === 'dept_leader' && me.categoryIds?.length) {
      filter.categoryId = { $in: me.categoryIds }
    }

    if (status) filter.status = status
    if (assignedTo === 'none') filter.assignedTo = null
    else if (assignedTo) filter.assignedTo = assignedTo
    if (categoryId) filter.categoryId = categoryId
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ displayName: regex }, { contact: regex }, { content: regex }]
    }

    const [feedbacks, total] = await Promise.all([
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('assignedTo', 'fullName')
        .populate('categoryId', 'name icon')
        .lean(),
      Feedback.countDocuments(filter),
    ])

    // Enrich displayName từ Redis profile cache cho những feedback chưa có tên
    const missing = feedbacks.filter((f) => !f.displayName && f.userId).map((f) => f.userId)
    if (missing.length) {
      const profiles = await getProfiles(missing)
      feedbacks.forEach((f) => {
        if (!f.displayName && f.userId && profiles[f.userId]?.display_name) {
          f.displayName = profiles[f.userId].display_name
        }
      })
    }

    res.json({ feedbacks, pagination: { page: parseInt(page), totalPages: Math.ceil(total / limit), total } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /:id — chi tiết
router.get('/:id', async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate('assignedTo', 'fullName username')
      .populate('assignedBy', 'fullName')
      .populate('respondedBy', 'fullName')
      .populate('draftBy', 'fullName')
      .populate('approvedBy', 'fullName')
      .populate('categoryId', 'name icon zaloGroupId')
      .lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })

    // Lấy danh sách cán bộ để phân công
    const me = req.user
    let admins = []
    if (LEADER_ROLES.includes(me.role)) {
      const roleFilter = me.role === 'superadmin'
        ? { role: { $in: ['officer', 'dept_leader', 'staff'] } }
        : { role: 'officer', categoryIds: feedback.categoryId?._id }
      admins = await AdminUser.find(roleFilter, 'fullName username role').lean()
    }

    const categories = await Category.find({}).sort({ order: 1 }).lean()
    res.json({ feedback, admins, categories })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /:id — cập nhật note (officer + leader)
router.put('/:id', async (req, res) => {
  try {
    const { note } = req.body
    const update = { updatedAt: new Date() }
    if (note !== undefined) update.note = note
    await Feedback.findByIdAndUpdate(req.params.id, update)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /:id — xóa (superadmin)
router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /:id/assign — phân công (superadmin, dept_leader)
router.post('/:id/assign', requireRole('superadmin', 'dept_leader'), async (req, res) => {
  try {
    const { assignedTo } = req.body
    const feedback = await Feedback.findById(req.params.id).populate('categoryId', 'name zaloGroupId').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })

    await Feedback.findByIdAndUpdate(req.params.id, {
      assignedTo: assignedTo || null,
      assignedBy: req.user.id,
      updatedAt: new Date(),
    })

    // Thông báo vào nhóm Zalo kèm @mention cán bộ
    if (assignedTo) {
      const officer = await AdminUser.findById(assignedTo, 'fullName zaloUserId').lean()
      const catName = feedback.categoryId?.name || ''
      const groupId = feedback.categoryId?.zaloGroupId
      const shortCode = feedback._id.toString().slice(-5).toUpperCase()
      const mentionTag = `@${officer?.fullName || assignedTo}`
      const msg =
        `📋 PHÂN CÔNG XỬ LÝ PHẢN ÁNH\n` +
        `${'─'.repeat(28)}\n` +
        `👤 Cán bộ: ${mentionTag}\n` +
        `🏷️ Loại: ${catName}\n` +
        `🆔 Mã: #${shortCode}\n` +
        `📝 Nội dung: ${feedback.content.slice(0, 80)}...`

      // Nếu cán bộ có zaloUserId thì gửi @mention thật trong nhóm Zalo
      const mentions = []
      if (officer?.zaloUserId) {
        const pos = msg.indexOf(mentionTag)
        if (pos !== -1) {
          mentions.push({
            user_id: officer.zaloUserId,
            display_name: officer.fullName || '',
            pos,
            len: mentionTag.length,
          })
        }
      }
      await sendZaloToGroup(msg, groupId, mentions)
    }

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /:id/draft — cán bộ soạn dự thảo trả lời
router.post('/:id/draft', requireRole('officer', 'staff'), async (req, res) => {
  try {
    const { draftResponse } = req.body
    if (!draftResponse?.trim()) return res.status(400).json({ error: 'Vui lòng nhập nội dung dự thảo' })

    const feedback = await Feedback.findById(req.params.id).populate('categoryId', 'name zaloGroupId').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (feedback.status === 'resolved') {
      return res.status(400).json({ error: 'Phản ánh đã được giải quyết, không thể sửa dự thảo' })
    }

    await Feedback.findByIdAndUpdate(req.params.id, {
      draftResponse: draftResponse.trim(),
      draftBy: req.user.id,
      draftAt: new Date(),
      status: 'draft',
      updatedAt: new Date(),
    })

    // Thông báo lãnh đạo qua nhóm
    const shortCode = feedback._id.toString().slice(-5).toUpperCase()
    const groupId = feedback.categoryId?.zaloGroupId
    const msg =
      `📄 DỰ THẢO CHỜ DUYỆT\n` +
      `${'─'.repeat(28)}\n` +
      `🆔 Mã: #${shortCode}\n` +
      `🏷️ Loại: ${feedback.categoryId?.name || ''}\n` +
      `✍️ Nội dung dự thảo:\n${draftResponse.trim().slice(0, 150)}\n` +
      `(Vui lòng vào hệ thống để duyệt)`
    await sendZaloToGroup(msg, groupId)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /:id/approve — lãnh đạo duyệt dự thảo (có thể sửa nội dung), gửi trả dân
router.post('/:id/approve', requireRole('superadmin', 'dept_leader'), async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id).populate('categoryId', 'name zaloGroupId').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (feedback.status !== 'draft') {
      return res.status(400).json({ error: 'Chỉ duyệt được phản ánh ở trạng thái Dự thảo' })
    }
    if (!feedback.draftResponse?.trim() && !req.body.finalResponse?.trim()) {
      return res.status(400).json({ error: 'Chưa có nội dung phản hồi' })
    }

    // Lãnh đạo có thể sửa nội dung trước khi gửi; nếu không sửa thì dùng bản dự thảo gốc
    const finalResponse = req.body.finalResponse?.trim() || feedback.draftResponse.trim()

    // Gửi tin cho dân qua Zalo OA
    await sendZaloText(feedback.userId, finalResponse)

    await Feedback.findByIdAndUpdate(req.params.id, {
      finalResponse,
      approvedBy: req.user.id,
      sentAt: new Date(),
      status: 'resolved',
      // Legacy compat
      response: finalResponse,
      respondedAt: new Date(),
      respondedBy: req.user.id,
      updatedAt: new Date(),
    })

    // Thông báo vào nhóm
    const shortCode = feedback._id.toString().slice(-5).toUpperCase()
    const groupId = feedback.categoryId?.zaloGroupId
    const msg =
      `✅ PHẢN ÁNH ĐÃ ĐƯỢC DUYỆT & GỬI DÂN\n` +
      `${'─'.repeat(28)}\n` +
      `🆔 Mã: #${shortCode}\n` +
      `🏷️ Loại: ${feedback.categoryId?.name || ''}`
    await sendZaloToGroup(msg, groupId)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /:id/reject — lãnh đạo từ chối dự thảo, trả về cán bộ
router.post('/:id/reject', requireRole('superadmin', 'dept_leader'), async (req, res) => {
  try {
    const { rejectedReason } = req.body
    const feedback = await Feedback.findById(req.params.id).populate('categoryId', 'name zaloGroupId').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (feedback.status !== 'draft') {
      return res.status(400).json({ error: 'Chỉ từ chối được phản ánh ở trạng thái Dự thảo' })
    }

    await Feedback.findByIdAndUpdate(req.params.id, {
      rejectedReason: rejectedReason?.trim() || '',
      status: 'pending',
      updatedAt: new Date(),
    })

    // Thông báo vào nhóm
    const shortCode = feedback._id.toString().slice(-5).toUpperCase()
    const groupId = feedback.categoryId?.zaloGroupId
    const msg =
      `❌ DỰ THẢO BỊ TỪ CHỐI — CẦN SỬA LẠI\n` +
      `${'─'.repeat(28)}\n` +
      `🆔 Mã: #${shortCode}\n` +
      `🏷️ Loại: ${feedback.categoryId?.name || ''}\n` +
      (rejectedReason ? `📌 Lý do: ${rejectedReason.trim()}` : '')
    await sendZaloToGroup(msg, groupId)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /:id/reply — gửi Zalo thủ công (legacy, giữ lại cho lãnh đạo)
router.post('/:id/reply', requireRole('superadmin', 'dept_leader'), async (req, res) => {
  try {
    const { response } = req.body
    if (!response?.trim()) return res.status(400).json({ error: 'Vui lòng nhập nội dung phản hồi' })
    const feedback = await Feedback.findById(req.params.id)
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    await sendZaloText(feedback.userId, response.trim())
    await Feedback.findByIdAndUpdate(req.params.id, {
      finalResponse: response.trim(),
      response: response.trim(),
      respondedAt: new Date(),
      respondedBy: req.user.id,
      sentAt: new Date(),
      status: 'resolved',
      updatedAt: new Date(),
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
