const router = require('express').Router();
const AdminUser = require('../../models/AdminUser');

router.get('/login', (req, res) => {
  if (req.session.adminUser) return res.redirect('/admin');
  res.render('login', {
    error: req.flash('error')[0] || null,
    success: req.flash('success')[0] || null,
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    req.flash('error', 'Vui lòng nhập đầy đủ thông tin');
    return res.redirect('/admin/login');
  }
  try {
    const user = await AdminUser.findOne({ username: username.trim().toLowerCase() });
    if (!user || !(await user.comparePassword(password))) {
      req.flash('error', 'Tên đăng nhập hoặc mật khẩu không đúng');
      return res.redirect('/admin/login');
    }
    req.session.adminUser = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    };
    const returnTo = req.session.returnTo || '/admin';
    delete req.session.returnTo;
    return res.redirect(returnTo);
  } catch (err) {
    req.flash('error', 'Lỗi hệ thống: ' + err.message);
    return res.redirect('/admin/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

module.exports = router;
