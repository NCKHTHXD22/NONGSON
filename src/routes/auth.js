const router = require('express').Router()
const jwt = require('jsonwebtoken')
const AdminUser = require('../models/AdminUser')
const requireAuth = require('../middleware/requireAuth')
const { sendZaloText } = require('../utils/zaloApi')

const JWT_SECRET = process.env.JWT_SECRET || 'nongson-jwt-secret-2025'

// OTP lưu trong memory: { username → { otp, expiresAt } }
const otpStore = new Map()

router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin' })
  }
  try {
    const user = await AdminUser.findOne({ username: username.trim().toLowerCase() })
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' })
    }
    const payload = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      categoryIds: user.categoryIds?.map(c => c.toString()) || [],
      zaloUserId: user.zaloUserId || '',
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
    req.session.adminUser = payload
    return res.json({ user: payload, token })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/forgot-password — gửi OTP 6 số qua Zalo
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body
  if (!username) return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập' })
  try {
    const user = await AdminUser.findOne({ username: username.trim().toLowerCase() })
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })
    if (!user.zaloUserId) {
      return res.status(400).json({ error: 'Tài khoản chưa liên kết Zalo. Liên hệ quản trị viên để được hỗ trợ.' })
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    otpStore.set(username.trim().toLowerCase(), { otp, expiresAt: Date.now() + 5 * 60 * 1000 })

    await sendZaloText(
      user.zaloUserId,
      `🔐 Mã xác nhận đặt lại mật khẩu hệ thống UBND Nong Son:\n\n` +
      `     ${otp}\n\n` +
      `⏰ Mã có hiệu lực trong 5 phút.\n` +
      `⚠️ Không chia sẻ mã này cho bất kỳ ai.`
    )

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/reset-password — xác minh OTP và đặt mật khẩu mới
router.post('/reset-password', async (req, res) => {
  const { username, otp, newPassword } = req.body
  if (!username || !otp || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' })

  const key = username.trim().toLowerCase()
  const entry = otpStore.get(key)

  if (!entry) return res.status(400).json({ error: 'Mã OTP không hợp lệ hoặc đã hết hạn' })
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key)
    return res.status(400).json({ error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.' })
  }
  if (entry.otp !== otp.trim()) return res.status(400).json({ error: 'Mã OTP không đúng' })
  if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' })

  try {
    const user = await AdminUser.findOne({ username: key })
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })

    user.password = newPassword
    await user.save()
    otpStore.delete(key)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }))
})

router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.session?.adminUser?.id
    const user = await AdminUser.findById(userId, '-password').lean()
    if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' })
    res.json({
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      categoryIds: user.categoryIds?.map(c => c.toString()) || [],
      zaloUserId: user.zaloUserId || '',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
