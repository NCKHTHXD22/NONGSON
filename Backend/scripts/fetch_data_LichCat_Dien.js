/**
 * fetch_data_LichCat_Dien.js
 * Cào lịch tạm ngừng cung cấp điện từ EVNCPC (cskh.cpc.vn) — TOÀN BỘ Điện lực Đà Nẵng,
 * sau đó tách/lọc theo từng đơn vị (vd Điện lực Nong Son = PC05MM).
 *
 * Nguồn (reverse-engineer từ SPA cskh.cpc.vn) — KHÔNG cần CAPTCHA:
 *   - Danh sách đơn vị con: GET /api/remote/organizations?maDonViCapTren=PP   (header version:1.0)
 *   - Lịch cắt điện 1 đơn vị: GET /api/remote/outages/area?orgCode=PP&subOrgCode=<code>&fromDate=&toDate=
 *     (BẮT BUỘC subOrgCode, nếu không API trả mẫu xoay vòng)
 *
 * Chạy thử:
 *   node scripts/fetch_data_LichCat_Dien.js                 → tổng hợp tất cả đơn vị
 *   node scripts/fetch_data_LichCat_Dien.js "Nong Son"       → lọc theo đơn vị/trạm
 *   node scripts/fetch_data_LichCat_Dien.js 12/06            → lọc theo ngày
 */

const { fetchAllOutages } = require('../src/services/catDienService');

function matches(doc, query) {
  const q = query.toLowerCase().trim().normalize('NFC');
  if (!q || ['tất cả', 'tat ca', 'tatca'].includes(q)) return true;
  const dateMatch = q.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (dateMatch) {
    const [, d, m] = dateMatch;
    const dt = doc.fromDate;
    return dt && dt.getDate() === parseInt(d) && dt.getMonth() + 1 === parseInt(m);
  }
  return `${doc.subOrgName} ${doc.stationName} ${doc.reason}`.toLowerCase().normalize('NFC').includes(q);
}

if (require.main === module) {
  const query = process.argv[2] || '';
  (async () => {
    try {
      const all = await fetchAllOutages();
      console.log(`\n[EVNCPC] Tổng lịch cắt điện toàn Điện lực Đà Nẵng: ${all.length} mục`);

      // Tổng hợp theo đơn vị
      const byUnit = {};
      all.forEach((d) => { byUnit[d.subOrgName] = (byUnit[d.subOrgName] || 0) + 1; });
      console.log('--- Theo đơn vị ---');
      Object.entries(byUnit).sort((a, b) => b[1] - a[1]).forEach(([u, c]) => console.log(`  [${c}] ${u}`));

      const filtered = all.filter((d) => matches(d, query));
      console.log(`\n[EVNCPC] Lọc theo "${query || 'tất cả'}": ${filtered.length} mục\n`);
      filtered.slice(0, 30).forEach((o, i) => {
        console.log(`${i + 1}. [${o.outageType}] ${o.stationName} — ${o.subOrgName}`);
        console.log(`   ⏰ ${o.fromDateStr} → ${o.toDateStr} | ${o.statusStr}`);
        if (o.reason) console.log(`   📝 ${o.reason}`);
      });
      console.log('');
    } catch (err) {
      console.error('[EVNCPC] Lỗi:', err.response?.status || '', err.message);
      process.exit(1);
    }
  })();
}
