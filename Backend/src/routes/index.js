const router = require('express').Router()
const requireAuth = require('../middleware/requireAuth')
const authRoutes = require('./auth')
const publicRoutes = require('./public')
const statsRoutes = require('./stats')
const feedbackRoutes = require('./feedbacks')
const userRoutes = require('./users')
const categoryRoutes = require('./categories')
const zaloMembersRoutes = require('./zalo-members')
const broadcastRoutes = require('./broadcast')
const catDienRoutes = require('./cat-dien')
const notificationRoutes = require('./notifications')
const reportRoutes = require('./reports')

router.use('/auth', authRoutes)
router.use('/public', publicRoutes)

// Công khai (không cần đăng nhập) — dữ liệu lịch cắt điện công cộng
router.use('/cat-dien', catDienRoutes)

router.use(requireAuth)
router.use('/stats', statsRoutes)
router.use('/feedbacks', feedbackRoutes)
router.use('/users', userRoutes)
router.use('/categories', categoryRoutes)
router.use('/zalo-members', zaloMembersRoutes)
router.use('/broadcast', broadcastRoutes)
router.use('/notifications', notificationRoutes)
router.use('/reports', reportRoutes)

module.exports = router
