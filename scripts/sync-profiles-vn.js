/**
 * sync-profiles-vn.js
 * Chạy trên VPS Việt Nam — tự lấy Zalo token từ Redis, không cần paste tay.
 *
 * Cách dùng:
 *   UPSTASH_REDIS_REST_URL=xxx UPSTASH_REDIS_REST_TOKEN=xxx node sync-profiles-vn.js
 */

const https = require('https');

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!REDIS_URL || !REDIS_TOKEN) {
  console.error('❌ Thiếu: UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN');
  process.exit(1);
}

// ── HTTP helpers ───────────────────────────────────────────────────
function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, path: u.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    }).on('error', reject);
  });
}

async function redis(...args) {
  const r = await httpPost(REDIS_URL, args, { Authorization: `Bearer ${REDIS_TOKEN}` });
  return r?.result ?? null;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Bắt đầu sync profile từ VPS Việt Nam...\n');

  // 1. Lấy Zalo token từ Redis (server tự refresh, luôn mới nhất)
  const zaloToken = await redis('GET', 'nongson_zalo_access_token');
  if (!zaloToken) {
    console.error('❌ Không tìm thấy nongson_zalo_access_token trong Redis');
    console.log('   Đảm bảo Render server đã chạy ít nhất 1 lần để lưu token vào Redis');
    process.exit(1);
  }
  console.log(`✅ Đọc Zalo token từ Redis: ${zaloToken.slice(0, 20)}...`);

  // Test token còn hạn không
  const testUid = '0';
  const testData = encodeURIComponent(JSON.stringify({ user_id: testUid }));
  const testResult = await httpGet(
    `https://openapi.zalo.me/v2.0/oa/getprofile?data=${testData}`,
    { access_token: zaloToken }
  );
  if (testResult?.error === -216) {
    console.error('❌ Token hết hạn. Cần lấy token mới từ Render và lưu lại vào Redis.');
    process.exit(1);
  }
  console.log(`✅ Token hợp lệ (test response: error=${testResult?.error})\n`);

  // 2. Lấy danh sách follower
  const raw = await redis('GET', 'nongson_oa_followers');
  if (!raw) {
    console.error('❌ Không có dữ liệu followers (key: nongson_oa_followers)');
    console.log('   Bấm Đồng bộ trên trang Followers trước rồi chạy lại script này');
    process.exit(1);
  }
  const followers = JSON.parse(raw);
  console.log(`📋 Tổng follower: ${followers.length}\n`);

  // 3. Fetch profile từng người
  let success = 0, failed = 0, skipped = 0;

  for (let i = 0; i < followers.length; i++) {
    const userId = followers[i].user_id;

    // Bỏ qua nếu đã có tên trong cache
    const cached = await redis('GET', `nongson_profile:${userId}`);
    if (cached) {
      try {
        const p = JSON.parse(cached);
        if (p.display_name && p.display_name !== userId) {
          skipped++;
          if ((i + 1) % 50 === 0) {
            console.log(`[${i+1}/${followers.length}] ✅${success} ❌${failed} ⏭${skipped}`);
          }
          continue;
        }
      } catch {}
    }

    try {
      const data = encodeURIComponent(JSON.stringify({ user_id: userId }));
      const result = await httpGet(
        `https://openapi.zalo.me/v2.0/oa/getprofile?data=${data}`,
        { access_token: zaloToken }
      );

      if (result?.error === 0 && result?.data?.display_name) {
        const value = JSON.stringify({
          display_name: result.data.display_name,
          avatar: result.data.avatar || '',
        });
        await redis('SET', `nongson_profile:${userId}`, value, 'EX', 7776000);
        success++;
        process.stdout.write('✓');
      } else {
        failed++;
        process.stdout.write('·');
      }
    } catch {
      failed++;
      process.stdout.write('!');
    }

    if ((i + 1) % 50 === 0) {
      console.log(` [${i+1}/${followers.length}] ✅${success} ❌${failed} ⏭${skipped}`);
    }

    await delay(250);
  }

  console.log('\n\n✅ Hoàn tất!');
  console.log(`   Lấy được tên: ${success}`);
  console.log(`   Không có tên: ${failed} (user chưa chia sẻ profile)`);
  console.log(`   Đã có sẵn:   ${skipped}`);
  console.log('\n👉 Quay lại web, bấm Đồng bộ lại để cập nhật danh sách');
}

main().catch(console.error);
