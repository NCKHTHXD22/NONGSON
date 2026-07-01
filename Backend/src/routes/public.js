const router = require('express').Router()
const Feedback = require('../models/Feedback')

// GET /api/public/map-markers — không cần auth, dùng cho bản đồ trang login
router.get('/map-markers', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({
      status: { $nin: ['resolved', 'done'] },
      'location.lat': { $ne: null },
      'location.lng': { $ne: null },
    })
      .select('location content categoryId createdAt status')
      .populate('categoryId', 'name icon')
      .lean()

    const markers = feedbacks.map((fb) => ({
      id: fb._id.toString().slice(-5).toUpperCase(),
      lat: fb.location.lat,
      lng: fb.location.lng,
      address: fb.location.address || '',
      category: fb.categoryId?.name || 'Chưa phân loại',
      icon: fb.categoryId?.icon || '📋',
      content: fb.content.slice(0, 80) + (fb.content.length > 80 ? '...' : ''),
      createdAt: fb.createdAt,
      status: fb.status,
    }))

    res.json(markers)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/public/location-submit — nhận tọa độ GPS từ mini web page
router.post('/location-submit', async (req, res) => {
  try {
    const { uid, lat, lng } = req.body
    if (!uid || lat == null || lng == null) return res.status(400).json({ ok: false, message: 'Thiếu thông tin' })
    const { handleLocation } = require('../services/feedbackService')
    await handleLocation(String(uid), { lat: Number(lat), lng: Number(lng), address: '' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message })
  }
})

module.exports = router
