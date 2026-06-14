module.exports = (...roles) => (req, res, next) => {
  const userRole = req.user?.role || req.session?.adminUser?.role
  if (roles.includes(userRole)) return next()
  res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' })
}
