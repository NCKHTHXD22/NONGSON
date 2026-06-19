const router = require('express').Router()
const Feedback = require('../models/Feedback')
const { getProfiles } = require('../services/profileCache')

router.get('/', async (req, res) => {
  try {
    const [total, pending, processing, done] = await Promise.all([
      Feedback.countDocuments(),
      Feedback.countDocuments({ status: 'pending' }),
      Feedback.countDocuments({ status: 'processing' }),
      Feedback.countDocuments({ status: 'done' }),
    ])

    const recent = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assignedTo', 'fullName')
      .lean()

    // Enrich displayName + avatar từ Redis profile cache
    const missingIds = recent.filter((f) => !f.displayName && f.userId).map((f) => f.userId)
    if (missingIds.length) {
      const profiles = await getProfiles(missingIds)
      recent.forEach((f) => {
        if (f.userId && profiles[f.userId]) {
          if (!f.displayName && profiles[f.userId].display_name) {
            f.displayName = profiles[f.userId].display_name
          }
          if (!f.avatar) f.avatar = profiles[f.userId].avatar || ''
        }
      })
    }

    const days = [], counts = []
    for (let i = 6; i >= 0; i--) {
      const start = new Date()
      start.setDate(start.getDate() - i)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      const count = await Feedback.countDocuments({ createdAt: { $gte: start, $lt: end } })
      days.push(`${start.getDate()}/${start.getMonth() + 1}`)
      counts.push(count)
    }

    res.json({ stats: { total, pending, processing, done }, recent, chartDays: days, chartCounts: counts })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
