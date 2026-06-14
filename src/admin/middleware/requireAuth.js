module.exports = (req, res, next) => {
  if (req.session && req.session.adminUser) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/admin/login');
};
