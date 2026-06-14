module.exports = (...roles) => (req, res, next) => {
  if (roles.includes(req.session.adminUser?.role)) return next();
  req.flash('error', 'Bạn không có quyền thực hiện thao tác này');
  res.redirect('/admin');
};
