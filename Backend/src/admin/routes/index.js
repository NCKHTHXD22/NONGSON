const router = require('express').Router();
const requireAuth = require('../middleware/requireAuth');
const authRoutes = require('./auth');
const dashboardRoutes = require('./dashboard');
const feedbackRoutes = require('./feedbacks');
const userRoutes = require('./users');

// Auth routes không cần đăng nhập
router.use('/', authRoutes);

// Tất cả routes bên dưới yêu cầu đăng nhập
router.use(requireAuth);
router.use('/', dashboardRoutes);
router.use('/feedbacks', feedbackRoutes);
router.use('/users', userRoutes);

module.exports = router;
