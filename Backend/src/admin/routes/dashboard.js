const router = require('express').Router();
const Feedback = require('../../models/Feedback');

router.get('/', async (req, res) => {
  try {
    const [total, pending, processing, done] = await Promise.all([
      Feedback.countDocuments(),
      Feedback.countDocuments({ status: 'pending' }),
      Feedback.countDocuments({ status: 'processing' }),
      Feedback.countDocuments({ status: 'done' }),
    ]);

    const recent = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('assignedTo', 'fullName')
      .lean();

    const days = [], counts = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = await Feedback.countDocuments({ createdAt: { $gte: start, $lt: end } });
      days.push(`${start.getDate()}/${start.getMonth() + 1}`);
      counts.push(count);
    }

    res.render('dashboard', {
      user: req.session.adminUser,
      stats: { total, pending, processing, done },
      recent,
      chartDays: JSON.stringify(days),
      chartCounts: JSON.stringify(counts),
      flash: { error: req.flash('error')[0] || null, success: req.flash('success')[0] || null },
    });
  } catch (err) {
    res.render('dashboard', {
      user: req.session.adminUser,
      stats: { total: 0, pending: 0, processing: 0, done: 0 },
      recent: [],
      chartDays: '[]',
      chartCounts: '[]',
      flash: { error: err.message, success: null },
    });
  }
});

module.exports = router;
