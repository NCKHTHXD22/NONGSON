const router = require('express').Router();
const Feedback = require('../../models/Feedback');
const AdminUser = require('../../models/AdminUser');
const requireRole = require('../middleware/requireRole');
const { sendZaloText } = require('../../utils/zaloApi');

// GET / — danh sách với filter & phân trang
router.get('/', async (req, res) => {
  try {
    const { status, assignedTo, q, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;

    const filter = {};
    if (status) filter.status = status;
    if (assignedTo === 'none') filter.assignedTo = null;
    else if (assignedTo) filter.assignedTo = assignedTo;
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ displayName: regex }, { contact: regex }, { content: regex }];
    }

    const [feedbacks, total, admins] = await Promise.all([
      Feedback.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('assignedTo', 'fullName')
        .lean(),
      Feedback.countDocuments(filter),
      AdminUser.find({}, 'fullName username').lean(),
    ]);

    res.render('feedbacks/index', {
      user: req.session.adminUser,
      feedbacks,
      admins,
      filter: { status: status || '', assignedTo: assignedTo || '', q: q || '' },
      pagination: { page: parseInt(page), totalPages: Math.ceil(total / limit), total },
      flash: { error: req.flash('error')[0] || null, success: req.flash('success')[0] || null },
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
});

// GET /:id — chi tiết
router.get('/:id', async (req, res) => {
  try {
    const [feedback, admins] = await Promise.all([
      Feedback.findById(req.params.id)
        .populate('assignedTo', 'fullName username')
        .populate('respondedBy', 'fullName')
        .lean(),
      AdminUser.find({}, 'fullName username').lean(),
    ]);
    if (!feedback) {
      req.flash('error', 'Không tìm thấy góp ý');
      return res.redirect('/admin/feedbacks');
    }
    res.render('feedbacks/detail', {
      user: req.session.adminUser,
      feedback,
      admins,
      flash: { error: req.flash('error')[0] || null, success: req.flash('success')[0] || null },
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/feedbacks');
  }
});

// PUT /:id — cập nhật trạng thái & ghi chú
router.put('/:id', async (req, res) => {
  try {
    const { status, note } = req.body;
    const update = { updatedAt: new Date() };
    if (status) update.status = status;
    if (note !== undefined) update.note = note;
    await Feedback.findByIdAndUpdate(req.params.id, update);
    req.flash('success', 'Cập nhật thành công');
    res.redirect(`/admin/feedbacks/${req.params.id}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/admin/feedbacks/${req.params.id}`);
  }
});

// DELETE /:id — xóa (chỉ superadmin)
router.delete('/:id', requireRole('superadmin'), async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xóa góp ý');
    res.redirect('/admin/feedbacks');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/feedbacks');
  }
});

// POST /:id/reply — gửi phản hồi qua Zalo
router.post('/:id/reply', async (req, res) => {
  try {
    const { response } = req.body;
    if (!response?.trim()) {
      req.flash('error', 'Vui lòng nhập nội dung phản hồi');
      return res.redirect(`/admin/feedbacks/${req.params.id}`);
    }
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      req.flash('error', 'Không tìm thấy góp ý');
      return res.redirect('/admin/feedbacks');
    }
    await sendZaloText(feedback.userId, response.trim());
    await Feedback.findByIdAndUpdate(req.params.id, {
      response: response.trim(),
      respondedAt: new Date(),
      respondedBy: req.session.adminUser.id,
      status: feedback.status === 'pending' ? 'processing' : feedback.status,
      updatedAt: new Date(),
    });
    req.flash('success', 'Đã gửi phản hồi qua Zalo thành công');
    res.redirect(`/admin/feedbacks/${req.params.id}`);
  } catch (err) {
    req.flash('error', 'Lỗi gửi Zalo: ' + err.message);
    res.redirect(`/admin/feedbacks/${req.params.id}`);
  }
});

// POST /:id/assign — phân công xử lý
router.post('/:id/assign', async (req, res) => {
  try {
    const { assignedTo } = req.body;
    await Feedback.findByIdAndUpdate(req.params.id, {
      assignedTo: assignedTo || null,
      updatedAt: new Date(),
    });
    req.flash('success', 'Đã cập nhật phân công');
    res.redirect(`/admin/feedbacks/${req.params.id}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/admin/feedbacks/${req.params.id}`);
  }
});

module.exports = router;
