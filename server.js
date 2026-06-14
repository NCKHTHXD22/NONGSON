require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const mongoose = require('mongoose');
const CONFIG = require('./src/config');
const { handleWebhook } = require('./src/handlers/webhookHandler');
const { setTokensManually } = require('./src/utils/zaloToken');

const app = express();

// CORS — cho phép Vercel frontend gọi API
app.use(cors({
  origin: [
    /\.vercel\.app$/,
    'http://localhost:5173',
    'http://localhost:3001',
    process.env.PUBLIC_URL,
  ].filter(Boolean),
  credentials: true,
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/admin/views'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Method override (hỗ trợ PUT/DELETE từ HTML form)
app.use(methodOverride('_method'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'nongson-goopy-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 8 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));

// Flash messages
app.use(flash());

// Kết nối MongoDB + seed dữ liệu mặc định
mongoose.connect(CONFIG.MONGO_URI)
  .then(async () => {
    console.log('[MongoDB] Kết nối thành công');

    const AdminUser = require('./src/models/AdminUser');
    const Category = require('./src/models/Category');

    // Seed tài khoản admin mặc định
    const adminCount = await AdminUser.countDocuments();
    if (adminCount === 0) {
      await AdminUser.create({
        username: 'admin',
        password: 'admin@2025',
        fullName: 'Quản trị viên',
        role: 'superadmin',
      });
      console.log('[Admin] Tài khoản mặc định: admin / admin@2025 — đổi mật khẩu sau khi đăng nhập!');
    }

  })
  .catch(err => console.error('[MongoDB] Lỗi kết nối:', err.message));

// Request logging
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});

// ── Debug: test Zalo getprofile v2 vs v3 (public, tạm thời) ────
app.get('/debug-profile/:userId', async (req, res) => {
  const axios = require('axios');
  const { getToken } = require('./src/utils/zaloToken');
  try {
    const token = getToken();
    const uid = req.params.userId;

    // Test v2 getprofile — truyền user_id dạng số nguyên (tránh lỗi string vs number)
    const v2dataNum = encodeURIComponent(`{"user_id":${uid}}`);
    const v2 = await axios.get(
      `https://openapi.zalo.me/v2.0/oa/getprofile?data=${v2dataNum}`,
      { headers: { access_token: token } }
    ).then(r => r.data).catch(e => ({ error: e.message }));

    // Test v2 getprofile — truyền user_id dạng string (để so sánh)
    const v2dataStr = encodeURIComponent(JSON.stringify({ user_id: uid }));
    const v2str = await axios.get(
      `https://openapi.zalo.me/v2.0/oa/getprofile?data=${v2dataStr}`,
      { headers: { access_token: token } }
    ).then(r => r.data).catch(e => ({ error: e.message }));

    // Test raw getfollowers (1 người) để xem format user_id trả về
    const fdata = encodeURIComponent(JSON.stringify({ offset: 0, count: 1 }));
    const followers = await axios.get(
      `https://openapi.zalo.me/v2.0/oa/getfollowers?data=${fdata}`,
      { headers: { access_token: token } }
    ).then(r => r.data).catch(e => ({ error: e.message }));

    res.json({
      v2_as_number: v2,
      v2_as_string: v2str,
      getfollowers_sample: followers,
      token_prefix: token.slice(0, 20) + '...',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Webhook Zalo ──────────────────────────────────────
app.get('/webhook', (req, res) => {
  console.log('[Webhook] Xác thực Zalo webhook:', req.query.token);
  res.json({ token: req.query.token || '' });
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  // Nếu có FORWARD_WEBHOOK_TO → chỉ forward sang VPS, không xử lý ở đây
  if (process.env.FORWARD_WEBHOOK_TO) {
    const axios = require('axios');
    axios.post(`${process.env.FORWARD_WEBHOOK_TO}/webhook`, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    }).catch(err => console.error('[Webhook] Forward lỗi:', err.message));
    return;
  }

  try {
    await handleWebhook(req.body);
  } catch (err) {
    console.error('[Webhook] Lỗi xử lý:', err.message);
  }
});

// ── Zalo token thủ công (không cần auth, đặt TRƯỚC admin router) ──
app.get('/admin/set-tokens', (_req, res) => {
  res.send(`<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><title>Set Zalo Tokens - Nong Son</title>
  <style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 20px}
  textarea{width:100%;padding:8px;margin:8px 0;box-sizing:border-box;height:80px;font-size:12px}
  button{background:#0068ff;color:white;padding:10px 24px;border:none;cursor:pointer;border-radius:4px;font-size:16px}
  label{font-weight:bold}</style></head>
  <body><h2>Cập nhật Zalo Token - UBND Nong Son</h2>
  <form method="POST" action="/admin/set-tokens">
    <label>Access Token:</label>
    <textarea name="access_token" placeholder="Dán access_token vào đây" required></textarea>
    <label>Refresh Token:</label>
    <textarea name="refresh_token" placeholder="Dán refresh_token vào đây" required></textarea>
    <button type="submit">Lưu vào Redis</button>
  </form></body></html>`);
});

app.post('/admin/set-tokens', async (req, res) => {
  const { access_token, refresh_token } = req.body;
  if (!access_token || !refresh_token) return res.send('Lỗi: Cần cả 2 token');
  try {
    await setTokensManually(access_token.trim(), refresh_token.trim());
    res.send('<h2>✅ Token đã lưu vào Redis! Hệ thống sẽ tự động refresh mãi mãi.</h2>');
  } catch (err) {
    res.send(`<h2>❌ Lỗi: ${err.message}</h2>`);
  }
});

// ── Internal sync endpoint (bảo vệ bằng secret token) ──
app.post('/internal/sync-followers', async (req, res) => {
  const secret = req.headers['x-sync-secret'] || req.query.secret;
  if (!secret || secret !== process.env.SYNC_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const { syncFollowers } = require('./src/services/followerService');
    const followers = await syncFollowers();
    res.json({ ok: true, count: followers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Scheduler gửi tin nhắn theo lịch ──────────────────
require('./src/services/schedulerService').start();

// ── Tự động đồng bộ lịch cắt điện EVNCPC (mỗi 30 phút) ──
require('./src/services/catDienService').startAutoSync();

// ── REST API cho React frontend ────────────────────────
const apiRouter = require('./src/routes/index');
app.use('/api', apiRouter);

// ── Admin dashboard router (EJS) ────────────────────────
const adminRouter = require('./src/admin/routes/index');
app.use('/admin', adminRouter);

// ── Các route khác ──────────────────────────────────────
app.get('/zalo_verifierMy2z1PYq6XmTWRKu-gqbEpgZaXZMrKT1CJCm.html', (req, res) => {
  res.type('html').send('There Is No Limit To What You Can Accomplish Using Zalo!');
});

app.get('/zalo_verifierOFpW5E3FJ1Xguy4-eUrB0sVec1w8dar8EJ4r.html', (req, res) => {
  res.type('html').send('There Is No Limit To What You Can Accomplish Using Zalo!');
});

app.get('/zalo_verifierOFpW5E3FJ1Xguy4-eUrB0sVec1wBdar8EJ4r.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'zalo_verifierOFpW5E3FJ1Xguy4-eUrB0sVec1wBdar8EJ4r.html'));
});

app.get('/', async (req, res) => {
  const { code } = req.query;
  if (code) {
    try {
      const axios = require('axios');
      const params = new URLSearchParams();
      params.append('code', code);
      params.append('app_id', process.env.ZALO_APP_ID);
      params.append('grant_type', 'authorization_code');
      const r = await axios.post(
        'https://oauth.zaloapp.com/v4/oa/access_token',
        params,
        { headers: { secret_key: process.env.ZALO_APP_SECRET, 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const { access_token, refresh_token } = r.data;
      if (access_token) {
        await setTokensManually(access_token, refresh_token);
        console.log('[OAuth] Lấy token mới từ OAuth thành công');
        return res.type('html').send('<h2>✅ Cấp quyền thành công! Token đã lưu vào Redis. Bot sẵn sàng hoạt động.</h2>');
      }
      return res.type('html').send(`<h2>❌ Lỗi: ${JSON.stringify(r.data)}</h2>`);
    } catch (err) {
      return res.type('html').send(`<h2>❌ Lỗi: ${err.message}</h2>`);
    }
  }
  res.type('html').send(`<!DOCTYPE html><html><head><meta name="zalo-platform-site-verification" content="OFpW5E3FJ1Xguy4-eUrB0sVec1wBdar8EJ4r" /></head><body>UBND phuong Nong Son - OA Zalo</body></html>`);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', project: 'UBND Nong Son - Góp ý', timestamp: new Date().toISOString() });
});

// ── Serve file upload tạm (video broadcast) tại /images ──
const uploadDir = path.join(__dirname, 'public', 'images');
require('fs').mkdirSync(uploadDir, { recursive: true });
app.use('/images', express.static(uploadDir));

// ── Serve React build (production) ─────────────────────
const webDist = path.join(__dirname, 'Web', 'dist');
if (require('fs').existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('/app*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

app.listen(CONFIG.PORT, () => {
  console.log(`\n🚀 Server Nong Son Góp ý chạy tại http://localhost:${CONFIG.PORT}`);
  console.log(`📡 Webhook URL: http://localhost:${CONFIG.PORT}/webhook`);
  console.log(`🖥️  Admin Dashboard: http://localhost:${CONFIG.PORT}/admin\n`);
});
