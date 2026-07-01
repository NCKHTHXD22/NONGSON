const router = require('express').Router()
const Notification = require('../models/Notification')

router.get('/', async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('feedbackId', 'content status')
        .lean(),
      Notification.countDocuments({ userId: req.user.id, isRead: false }),
    ])
    res.json({ notifications, unreadCount })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:id/read', async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true }
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/read-all', async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
