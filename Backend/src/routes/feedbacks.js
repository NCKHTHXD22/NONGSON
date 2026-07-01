const router = require('express').Router()
const path = require('path')
const multer = require('multer')
const Feedback = require('../models/Feedback')
const AdminUser = require('../models/AdminUser')
const Category = require('../models/Category')
const Notification = require('../models/Notification')
const requireRole = require('../middleware/requireRole')
const { sendZaloText, sendZaloToGroup, sendAttachmentsToUser } = require('../utils/zaloApi')
const { sendMail, buildFeedbackEmailHtml } = require('../utils/mailer')
const { getProfiles } = require('../services/profileCache')
const { uploadBufferGeneric } = require('../utils/cloudinary')
const { notifyAssignment } = require('../services/assignmentNotify')

const memoryUpload = multer({ storage: multer.memoryStorage() })

const LEADER_ROLES = ['superadmin', 'dept_leader']

function canAccessFeedback(user, feedback) {
  if (user.role === 'superadmin') return true
  if (user.role === 'dept_leader') {
    if (!user.categoryIds?.length) return true
    const catId = String(feedback.categoryId?._id || feedback.categoryId || '')
    return user.categoryIds.some((id) => String(id) === catId)
  }
  if (user.role === 'officer' || user.role === 'staff') {
    const assignedId = String(feedback.assignedTo?._id || feedback.assignedTo || '')
    return !!assignedId && assignedId === String(user.id)
  }
  return false
}

// GET / — danh sách
router.get('/', async (req, res) => {
  try {
    const { status, assignedTo, categoryId, q, page = 1 } = req.query
    const limit = 20
    const skip = (parseInt(page) - 1) * limit
    const filter = {}

    const me = req.user
    if (me.role === 'officer' || me.role === 'staff') {
      filter.assignedTo = me.id
    } else if (me.role === 'dept_leader' && me.categoryIds?.length) {
      filter.categoryId = { $in: me.categoryIds }
    }

    if (status) filter.status = status
    if (assignedTo === 'none') filter.assignedTo = null
    else if (assignedTo) filter.assignedTo = assignedTo
    if (categoryId) filter.categoryId = categoryId
    if (q) {
      const cleanQ = q.replace(/^#/, '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(cleanQ, 'i')
      filter.$or = [
        { displayName: regex },
        { contact: regex },
        { content: regex },
        { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: cleanQ, options: 'i' } } },
      ]
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

    const needProfile = feedbacks.filter((f) => f.userId && (!f.displayName || !f.avatar)).map((f) => f.userId)
    if (needProfile.length) {
      const profiles = await getProfiles(needProfile)
      feedbacks.forEach((f) => {
        const p = f.userId && profiles[f.userId]
        if (!p) return
        if (!f.displayName && p.display_name) f.displayName = p.display_name
        if (!f.avatar) f.avatar = p.avatar || ''
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
      .populate('assignAttachments.sentBy', 'fullName')
      .populate('draftAttachments.sentBy', 'fullName')
      .lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (!canAccessFeedback(req.user, feedback)) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập phản ánh này' })
    }

    if (feedback.userId && (!feedback.displayName || !feedback.avatar)) {
      const profiles = await getProfiles([feedback.userId])
      const p = profiles[feedback.userId]
      if (p) {
        if (!feedback.displayName && p.display_name) feedback.displayName = p.display_name
        if (!feedback.avatar) feedback.avatar = p.avatar || ''
      }
    }

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

// PUT /:id — cập nhật note
router.put('/:id', async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id, 'categoryId assignedTo').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (!canAccessFeedback(req.user, feedback)) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập phản ánh này' })
    }

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

// ── Đính kèm nội bộ — upload lên Cloudinary ──

router.post('/attachments/upload/image', (req, res) => {
  const upload = memoryUpload.array('images', 5)
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.files?.length) return res.status(400).json({ error: 'Không có file' })
    if (req.files.some((f) => !f.mimetype.startsWith('image/'))) {
      return res.status(400).json({ error: 'Chỉ nhận file ảnh' })
    }
    if (req.files.some((f) => f.size > 10 * 1024 * 1024)) {
      return res.status(400).json({ error: 'Mỗi ảnh tối đa 10MB' })
    }
    try {
      const images = await Promise.all(
        req.files.map(async (f) => ({
          url: await uploadBufferGeneric(f.buffer, `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, 'image'),
          name: f.originalname,
        }))
      )
      res.json({ ok: true, images })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
})

router.post('/attachments/upload/video', (req, res) => {
  const upload = memoryUpload.single('video')
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'Không có file video' })
    if (req.file.size > 100 * 1024 * 1024) return res.status(400).json({ error: 'Video tối đa 100MB' })
    try {
      const url = await uploadBufferGeneric(req.file.buffer, `task_${Date.now()}`, 'video')
      res.json({ ok: true, url, name: req.file.originalname })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
})

router.post('/attachments/upload/file', (req, res) => {
  const ALLOWED_EXT = ['.docx', '.pdf', '.xlsx', '.xls']
  const upload = memoryUpload.single('file')
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message })
    if (!req.file) return res.status(400).json({ error: 'Không có file' })
    const ext = path.extname(req.file.originalname).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) return res.status(400).json({ error: 'Chỉ nhận file .docx, .pdf, .xlsx, .xls' })
    if (req.file.size > 20 * 1024 * 1024) return res.status(400).json({ error: 'File tối đa 20MB' })
    try {
      const safeName = `task_${Date.now()}_${req.file.originalname.replace(/[^\w.-]/g, '_')}`
      const url = await uploadBufferGeneric(req.file.buffer, safeName, 'raw')
      res.json({ ok: true, url, name: req.file.originalname })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
})

// POST /:id/assign — phân công (superadmin, dept_leader)
router.post('/:id/assign', requireRole('superadmin', 'dept_leader'), async (req, res) => {
  try {
    const { assignedTo, note, images, video, file } = req.body
    const feedback = await Feedback.findById(req.params.id).populate('categoryId', 'name zaloGroupId').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (!canAccessFeedback(req.user, feedback)) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập phản ánh này' })
    }

    const hasAttachments = !!(note?.trim() || images?.length || video?.url || file?.url)
    await Feedback.findByIdAndUpdate(req.params.id, {
      assignedTo: assignedTo || null,
      assignedBy: req.user.id,
      assignAttachments: {
        note: note?.trim() || '',
        images: images || [],
        video: video?.url ? video : { url: '', name: '' },
        file: file?.url ? file : { url: '', name: '' },
        sentBy: req.user.id,
        sentAt: new Date(),
      },
      updatedAt: new Date(),
    })

    if (assignedTo) {
      await notifyAssignment(feedback, assignedTo, { hasAttachments })
    }

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /:id/draft — cán bộ soạn dự thảo trả lời
router.post('/:id/draft', requireRole('officer', 'staff'), async (req, res) => {
  try {
    const { draftResponse, note, images, video, file } = req.body
    if (!draftResponse?.trim()) return res.status(400).json({ error: 'Vui lòng nhập nội dung dự thảo' })

    const feedback = await Feedback.findById(req.params.id).populate('categoryId', 'name zaloGroupId').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (!canAccessFeedback(req.user, feedback)) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập phản ánh này' })
    }
    if (feedback.status === 'resolved') {
      return res.status(400).json({ error: 'Phản ánh đã được giải quyết, không thể sửa dự thảo' })
    }

    const hasAttachments = !!(note?.trim() || images?.length || video?.url || file?.url)
    await Feedback.findByIdAndUpdate(req.params.id, {
      draftResponse: draftResponse.trim(),
      draftBy: req.user.id,
      draftAt: new Date(),
      status: 'draft',
      draftAttachments: {
        note: note?.trim() || '',
        images: images || [],
        video: video?.url ? video : { url: '', name: '' },
        file: file?.url ? file : { url: '', name: '' },
        sentBy: req.user.id,
        sentAt: new Date(),
      },
      updatedAt: new Date(),
    })

    const shortCode = feedback._id.toString().slice(-5).toUpperCase()
    const groupId = feedback.categoryId?.zaloGroupId
    const msg =
      `📄 DỰ THẢO CHỜ DUYỆT\n` +
      `${'─'.repeat(28)}\n` +
      `🆔 Mã: #${shortCode}\n` +
      `🏷️ Loại: ${feedback.categoryId?.name || ''}\n` +
      `✍️ Nội dung dự thảo:\n${draftResponse.trim().slice(0, 150)}\n` +
      `(Vui lòng vào hệ thống để duyệt)` +
      (hasAttachments ? `\n📎 Có tệp đính kèm — xem trên hệ thống` : '')
    await sendZaloToGroup(msg, groupId)

    const leaders = await AdminUser.find({
      role: 'dept_leader',
      $or: [{ categoryIds: feedback.categoryId?._id }, { categoryIds: { $size: 0 } }],
    }, 'fullName email').lean()

    await Promise.all(leaders.map((l) => Notification.create({
      userId: l._id,
      type: 'draft_submitted',
      feedbackId: feedback._id,
      message: `Dự thảo phản ánh #${shortCode} đang chờ bạn duyệt`,
    })))
    await Promise.all(leaders.filter((l) => l.email).map((l) => sendMail({
      to: l.email,
      subject: `[UBND Nông Sơn] Dự thảo chờ duyệt #${shortCode}`,
      html: buildFeedbackEmailHtml({ heading: 'Có dự thảo phản ánh đang chờ bạn duyệt', feedback, shortCode }),
    })))

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /:id/approve — lãnh đạo duyệt dự thảo, gửi trả dân
router.post('/:id/approve', requireRole('superadmin', 'dept_leader'), async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id).populate('categoryId', 'name zaloGroupId').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (!canAccessFeedback(req.user, feedback)) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập phản ánh này' })
    }
    if (feedback.status !== 'draft') {
      return res.status(400).json({ error: 'Chỉ duyệt được phản ánh ở trạng thái Dự thảo' })
    }
    if (!feedback.draftResponse?.trim() && !req.body.finalResponse?.trim()) {
      return res.status(400).json({ error: 'Chưa có nội dung phản hồi' })
    }

    const finalResponse = req.body.finalResponse?.trim() || feedback.draftResponse.trim()
    const notifyAdmin = !!req.body.notifyAdmin
    const shortCode = feedback._id.toString().slice(-5).toUpperCase()

    const citizenMsg =
      `📋 Mã phản ánh #${shortCode} đã hoàn tất xử lý\n` +
      `${'─'.repeat(32)}\n` +
      `${finalResponse}\n` +
      `${'─'.repeat(32)}\n` +
      `Cảm ơn bạn đã tin tưởng UBND Xã Nông Sơn!`
    await sendZaloText(feedback.userId, citizenMsg)

    await Feedback.findByIdAndUpdate(req.params.id, {
      finalResponse,
      approvedBy: req.user.id,
      sentAt: new Date(),
      status: 'resolved',
      response: finalResponse,
      respondedAt: new Date(),
      respondedBy: req.user.id,
      updatedAt: new Date(),
    })

    const groupId = feedback.categoryId?.zaloGroupId
    const msg =
      `✅ PHẢN ÁNH ĐÃ ĐƯỢC DUYỆT & GỬI DÂN\n` +
      `${'─'.repeat(28)}\n` +
      `🆔 Mã: #${shortCode}\n` +
      `🏷️ Loại: ${feedback.categoryId?.name || ''}`
    await sendZaloToGroup(msg, groupId)

    if (notifyAdmin) {
      const approver = await AdminUser.findById(req.user.id).lean()
      const admins = await AdminUser.find({ role: 'superadmin', zaloUserId: { $ne: '' } }).lean()
      const detailMsg =
        `📋 CHI TIẾT XỬ LÝ PHẢN ÁNH #${shortCode}\n` +
        `${'─'.repeat(28)}\n` +
        `🏷️ Loại: ${feedback.categoryId?.name || ''}\n` +
        `👤 Người dân: ${feedback.displayName || feedback.contact}\n` +
        `📝 Nội dung phản ánh: ${feedback.content}\n` +
        `✅ Phản hồi đã gửi: ${finalResponse}\n` +
        `👮 Duyệt bởi: ${approver?.fullName || ''}`
      await Promise.all(admins.map((a) => sendZaloText(a.zaloUserId, detailMsg)))
    }

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /:id/reject — lãnh đạo từ chối dự thảo
router.post('/:id/reject', requireRole('superadmin', 'dept_leader'), async (req, res) => {
  try {
    const { rejectedReason } = req.body
    const feedback = await Feedback.findById(req.params.id).populate('categoryId', 'name zaloGroupId').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (!canAccessFeedback(req.user, feedback)) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập phản ánh này' })
    }
    if (feedback.status !== 'draft') {
      return res.status(400).json({ error: 'Chỉ từ chối được phản ánh ở trạng thái Dự thảo' })
    }

    await Feedback.findByIdAndUpdate(req.params.id, {
      rejectedReason: rejectedReason?.trim() || '',
      status: 'pending',
      updatedAt: new Date(),
    })

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

// POST /:id/reply — gửi Zalo thủ công (legacy)
router.post('/:id/reply', requireRole('superadmin', 'dept_leader'), async (req, res) => {
  try {
    const { response } = req.body
    if (!response?.trim()) return res.status(400).json({ error: 'Vui lòng nhập nội dung phản hồi' })
    const feedback = await Feedback.findById(req.params.id).lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (!canAccessFeedback(req.user, feedback)) {
      return res.status(403).json({ error: 'Bạn không có quyền truy cập phản ánh này' })
    }
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

// POST /:id/resolve — superadmin tự xử lý: soạn & gửi thẳng cho dân, không cần phân công
router.post('/:id/resolve', requireRole('superadmin'), async (req, res) => {
  try {
    const { finalResponse, note, images, video, file } = req.body
    if (!finalResponse?.trim()) return res.status(400).json({ error: 'Vui lòng nhập nội dung phản hồi' })

    const feedback = await Feedback.findById(req.params.id).populate('categoryId', 'name zaloGroupId').lean()
    if (!feedback) return res.status(404).json({ error: 'Không tìm thấy góp ý' })
    if (feedback.status === 'resolved') return res.status(400).json({ error: 'Phản ánh đã được giải quyết' })

    const text = finalResponse.trim()
    const shortCode = feedback._id.toString().slice(-5).toUpperCase()

    const citizenMsg =
      `📋 Mã phản ánh #${shortCode} đã hoàn tất xử lý\n` +
      `${'─'.repeat(32)}\n` +
      `${text}\n` +
      `${'─'.repeat(32)}\n` +
      `Cảm ơn bạn đã tin tưởng UBND Xã Nông Sơn!`
    await sendZaloText(feedback.userId, citizenMsg)

    const attach = {
      note: note?.trim() || '',
      images: images || [],
      video: video?.url ? video : { url: '', name: '' },
      file: file?.url ? file : { url: '', name: '' },
    }
    if (images?.length || video?.url || file?.url) {
      await sendAttachmentsToUser(feedback.userId, attach)
    }

    // Admin vừa soạn vừa duyệt trong 1 bước — lưu cả draft lẫn phản hồi cuối để có lịch sử
    await Feedback.findByIdAndUpdate(req.params.id, {
      draftResponse: text,
      draftBy: req.user.id,
      draftAt: new Date(),
      draftAttachments: { ...attach, sentBy: req.user.id, sentAt: new Date() },
      finalResponse: text,
      approvedBy: req.user.id,
      respondedBy: req.user.id,
      respondedAt: new Date(),
      response: text,
      sentAt: new Date(),
      status: 'resolved',
      updatedAt: new Date(),
    })

    const groupId = feedback.categoryId?.zaloGroupId
    const msg =
      `✅ PHẢN ÁNH ĐÃ XỬ LÝ & GỬI DÂN\n` +
      `${'─'.repeat(28)}\n` +
      `🆔 Mã: #${shortCode}\n` +
      `🏷️ Loại: ${feedback.categoryId?.name || ''}`
    await sendZaloToGroup(msg, groupId)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
