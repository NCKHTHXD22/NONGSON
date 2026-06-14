const router = require('express').Router();
const { getOutages, syncOutages } = require('../services/catDienService');

// GET /api/cat-dien?q=12/06&donVi=PC05MM
//   q     : "" | "tất cả" | "dd/MM" | tên trạm
//   donVi : mã đơn vị điện lực (mặc định Nong Son); 'all' = toàn TP Đà Nẵng
router.get('/', async (req, res) => {
  try {
    const { q = '', donVi } = req.query;
    const items = await getOutages(q, donVi);
    res.json({ count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cat-dien/sync — cào lại ngay (tiện test, không chờ cron)
router.post('/sync', async (req, res) => {
  try {
    const synced = await syncOutages();
    res.json({ ok: true, synced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
