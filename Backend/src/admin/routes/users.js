const router = require('express').Router();
const AdminUser = require('../../models/AdminUser');
const requireRole = require('../middleware/requireRole');

router.use(requireRole('superadmin'));

// GET / — danh sách tài khoản
router.get('/', async (req, res) => {
  try {
    const users = await AdminUser.find().sort({ createdAt: 1 }).lean();
    res.render('users/index', {
      user: req.session.adminUser,
      users,
      flash: { error: req.flash('error')[0] || null, success: req.flash('success')[0] || null },
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin');
  }
});

// GET /new — form tạo tài khoản
router.get('/new', (req, res) => {
  res.render('users/form', {
    user: req.session.adminUser,
    editUser: null,
    flash: { error: req.flash('error')[0] || null, success: null },
  });
});

// POST / — tạo tài khoản
router.post('/', async (req, res) => {
  try {
    const { username, password, fullName, role } = req.body;
    if (!username || !password || !fullName) {
      req.flash('error', 'Vui lòng điền đầy đủ thông tin bắt buộc');
      return res.redirect('/admin/users/new');
    }
    await AdminUser.create({ username, password, fullName, role: role || 'staff' });
    req.flash('success', `Đã tạo tài khoản "${username}" thành công`);
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', err.code === 11000 ? 'Tên đăng nhập đã tồn tại' : err.message);
    res.redirect('/admin/users/new');
  }
});

// GET /:id/edit — form chỉnh sửa
router.get('/:id/edit', async (req, res) => {
  try {
    const editUser = await AdminUser.findById(req.params.id).lean();
    if (!editUser) {
      req.flash('error', 'Không tìm thấy tài khoản');
      return res.redirect('/admin/users');
    }
    res.render('users/form', {
      user: req.session.adminUser,
      editUser,
      flash: { error: req.flash('error')[0] || null, success: null },
    });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/users');
  }
});

// PUT /:id — cập nhật tài khoản
router.put('/:id', async (req, res) => {
  try {
    const { fullName, role, password } = req.body;
    const userToUpdate = await AdminUser.findById(req.params.id);
    if (!userToUpdate) {
      req.flash('error', 'Không tìm thấy tài khoản');
      return res.redirect('/admin/users');
    }
    userToUpdate.fullName = fullName;
    userToUpdate.role = role;
    if (password && password.trim()) {
      userToUpdate.password = password.trim();
    }
    await userToUpdate.save();
    req.flash('success', 'Cập nhật tài khoản thành công');
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect(`/admin/users/${req.params.id}/edit`);
  }
});

// DELETE /:id — xóa tài khoản
router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.session.adminUser.id) {
      req.flash('error', 'Không thể xóa tài khoản đang đăng nhập');
      return res.redirect('/admin/users');
    }
    await AdminUser.findByIdAndDelete(req.params.id);
    req.flash('success', 'Đã xóa tài khoản');
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('/admin/users');
  }
});

module.exports = router;
