const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'nongson-jwt-secret-2025'

module.exports = (req, res, next) => {
  // Ưu tiên JWT (dùng cho React frontend)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET)
      req.user = payload
      return next()
    } catch {
      // Token hết hạn hoặc sai → kiểm tra session bên dưới
    }
  }
  // Fallback session (dùng cho EJS admin panel)
  if (req.session?.adminUser) {
    req.user = req.session.adminUser
    return next()
  }
  res.status(401).json({ error: 'Chưa đăng nhập' })
}
