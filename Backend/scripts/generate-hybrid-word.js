const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip,
  Header, Footer, PageNumber, VerticalAlign,
} = require('docx');
const fs = require('fs');
const path = require('path');

const BLUE    = '1e40af';
const LBLUE   = 'dbeafe';
const PG_COL  = '4c1d95'; // PostgreSQL — tím
        const LPG     = 'ede9fe';
const MG_COL  = '7c2d12'; // MongoDB — cam
const LMG     = 'fff7ed';
const GREEN   = '14532d';
const LGREEN  = 'dcfce7';
const ORANGE  = '92400e';
const LORANGE = 'fef3c7';
const GRAY    = '374151';
const LGRAY   = 'f9fafb';
const WHITE   = 'FFFFFF';
const RED     = '991b1b';

/* ─── helpers ───────────────────────────────────── */
const sp = (before = 0, after = 120) => ({ spacing: { before, after } });

function h1(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, color: BLUE, font: 'Calibri' })],
    shading: { type: ShadingType.SOLID, color: LBLUE, fill: LBLUE },
    ...sp(360, 200),
    indent: { left: convertInchesToTwip(0.1) },
    border: { left: { style: BorderStyle.THICK, size: 6, color: BLUE } },
  });
}
function h2(text, color = '1d4ed8') {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color, font: 'Calibri' })],
    ...sp(240, 120),
  });
}
function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: GRAY })],
    ...sp(160, 80),
  });
}
function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: GRAY, ...opts })],
    ...sp(0, 100),
  });
}
function bullet(text, level = 0, color = GRAY) {
  return new Paragraph({
    children: [new TextRun({ text, size: 21, color })],
    bullet: { level },
    ...sp(0, 70),
  });
}
function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' } },
    ...sp(200, 200),
  });
}
function note(text, fill = LORANGE, color = ORANGE) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color, italics: true })],
    shading: { type: ShadingType.SOLID, color: fill, fill },
    ...sp(100, 150),
    indent: { left: convertInchesToTwip(0.15) },
  });
}
function codeBlock(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Courier New', size: 18, color: '1e293b' })],
    shading: { type: ShadingType.SOLID, color: 'f1f5f9', fill: 'f1f5f9' },
    ...sp(60, 60),
    indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
  });
}

function makeTable(headers, rows, colWidths, headerBg = BLUE) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, size: 20, color: WHITE })],
        alignment: AlignmentType.CENTER,
      })],
      shading: { type: ShadingType.SOLID, color: headerBg, fill: headerBg },
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => {
      let bg = ri % 2 === 0 ? WHITE : LGRAY;
      if (typeof cell === 'object' && cell.bg) { bg = cell.bg; }
      const text = typeof cell === 'object' ? cell.text : String(cell);
      const textColor = typeof cell === 'object' && cell.color ? cell.color : GRAY;
      return new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, size: 20, color: textColor })] })],
        shading: { type: ShadingType.SOLID, color: bg, fill: bg },
        width: { size: colWidths[ci], type: WidthType.PERCENTAGE },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
      });
    }),
  }));

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 80, bottom: 80 },
  });
}

/* ─── two-column comparison table ─────────────────── */
function compareTable(title1, items1, color1, title2, items2, color2) {
  const rows = [];
  const maxLen = Math.max(items1.length, items2.length);
  for (let i = 0; i < maxLen; i++) {
    rows.push(new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: items1[i] || '', size: 20, color: '4c1d95' })] })],
          shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? 'f5f3ff' : 'ede9fe', fill: i % 2 === 0 ? 'f5f3ff' : 'ede9fe' },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: items2[i] || '', size: 20, color: '7c2d12' })] })],
          shading: { type: ShadingType.SOLID, color: i % 2 === 0 ? 'fffbeb' : 'fef3c7', fill: i % 2 === 0 ? 'fffbeb' : 'fef3c7' },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
      ],
    }));
  }
  return new Table({
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: title1, bold: true, size: 22, color: WHITE })], alignment: AlignmentType.CENTER })],
            shading: { type: ShadingType.SOLID, color: PG_COL, fill: PG_COL },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: title2, bold: true, size: 22, color: WHITE })], alignment: AlignmentType.CENTER })],
            shading: { type: ShadingType.SOLID, color: MG_COL, fill: MG_COL },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          }),
        ],
      }),
      ...rows,
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4500, 4500],
    margins: { top: 80, bottom: 80 },
  });
}

/* ═══════════════════════════════════════════════════
   BUILD DOCUMENT
══════════════════════════════════════════════════ */
const doc = new Document({
  sections: [{
    properties: {
      page: {
        size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) },
        margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1) },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'KIẾN TRÚC HYBRID DATABASE — PostgreSQL + MongoDB', bold: true, size: 18, color: BLUE }),
            new TextRun({ text: '  |  Hệ thống Quản lý Hộ dân Xã Hoa Tiến', size: 18, color: '6b7280' }),
          ],
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e5e7eb' } },
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: 'Trang ', size: 18, color: '9ca3af' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '9ca3af' }),
            new TextRun({ text: '  /  ', size: 18, color: '9ca3af' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '9ca3af' }),
            new TextRun({ text: '          Vo Nguyen An — 06/06/2026', size: 18, color: '9ca3af' }),
          ],
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'e5e7eb' } },
        })],
      }),
    },
    children: [

      /* ── TRANG BÌA ── */
      new Paragraph({ children: [new TextRun({ text: '', break: 5 })] }),
      new Paragraph({ children: [new TextRun({ text: 'UBND XÃ HOA TIẾN', bold: true, size: 24, color: '6b7280' })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: '─────────────────────────────────', size: 26, color: 'e5e7eb' })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: 'KIẾN TRÚC HYBRID DATABASE', bold: true, size: 52, color: BLUE })], alignment: AlignmentType.CENTER, ...sp(300, 100) }),
      new Paragraph({ children: [new TextRun({ text: 'PostgreSQL  +  MongoDB', bold: true, size: 40, color: '7c3aed' })], alignment: AlignmentType.CENTER, ...sp(0, 200) }),
      new Paragraph({ children: [new TextRun({ text: 'Kết hợp 2 Database cho Hệ thống Quản lý Hộ dân\nXã Hoa Tiến — Tích hợp Zalo OA', italics: true, size: 24, color: '6b7280' })], alignment: AlignmentType.CENTER, ...sp(0, 600) }),
      new Paragraph({ children: [new TextRun({ text: 'Phiên bản: 1.0     |     Ngày: 06/06/2026', size: 22, color: '9ca3af' })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: '', break: 8 })] }),

      /* ── 1. TẠI SAO HYBRID ── */
      h1('1. TẠI SAO KẾT HỢP 2 DATABASE?'),
      p('Polyglot Persistence — dùng đúng database cho đúng loại dữ liệu. PostgreSQL và MongoDB không phải đối thủ mà là bổ sung cho nhau. Mỗi loại có điểm mạnh riêng và phù hợp với các bài toán khác nhau trong cùng một hệ thống.'),

      new Paragraph({ ...sp(150, 100) }),
      compareTable(
        '🐘 PostgreSQL — Mạnh ở đâu?',
        [
          'Dữ liệu có cấu trúc rõ ràng, quan hệ nhiều-nhiều',
          'Cần ACID transaction (tách hộ, gộp hộ)',
          'Query phức tạp: JOIN, GROUP BY, aggregate',
          'Báo cáo thống kê: SUM, COUNT, AVG theo thôn',
          'Ràng buộc dữ liệu: FK, UNIQUE, NOT NULL',
          'Search theo index: CCCD, SĐT cần exact match',
          'Schema ổn định, ít thay đổi cấu trúc',
        ],
        LPG,
        '🍃 MongoDB — Mạnh ở đâu?',
        [
          'Dữ liệu linh hoạt, schema có thể thay đổi',
          'Ghi nhanh, append-only: log, event stream',
          'Lưu JSON snapshot phức tạp: oldData/newData',
          'State machine: session trạng thái Zalo',
          'Full-text search: tìm kiếm theo tên',
          'Cache kết quả thống kê tổng hợp',
          'Không cần JOIN phức tạp, đọc document trọn vẹn',
        ],
        LMG,
      ),

      new Paragraph({ ...sp(200, 0) }),
      note('Kết luận: PostgreSQL giữ "source of truth" cho dữ liệu hộ dân. MongoDB xử lý log, cache, Zalo session. Hai DB hoàn toàn độc lập — nếu MongoDB down, nghiệp vụ chính vẫn chạy.'),
      divider(),

      /* ── 2. PHÂN CHIA DỮ LIỆU ── */
      h1('2. PHÂN CHIA DỮ LIỆU — "Cái gì vào DB nào?"'),

      h2('PostgreSQL — 6 bảng cốt lõi', PG_COL),
      makeTable(
        ['Bảng', 'Dữ liệu', 'Lý do dùng PostgreSQL'],
        [
          ['villages', 'Tên thôn, mã thôn, trưởng thôn', 'Ít bản ghi, FK reference, ổn định'],
          ['admin_users', 'Username, role, villageIds, zaloUserId', 'RBAC cần query chính xác, JOIN với villages'],
          ['households', 'soHoKhau, địa chỉ, toaDo, trangThai, loaiHo', 'Core data — cần ACID, FK, UNIQUE constraint'],
          ['members', 'Họ tên, CCCD, SĐT, ngày sinh, quanHe, laChuHo', 'Quan hệ 1-N với households, cần FK + index CCCD'],
          ['movement_records', 'householdId, loai, ngay, nguonGoc/noiDen', 'Dữ liệu biến động — cần JOIN, thống kê theo kỳ'],
          ['household_relations', 'type (SPLIT/MERGE), source_id, target_id, date', 'Lưu mối quan hệ tách/gộp — cần FK integrity'],
        ],
        [18, 38, 44],
        PG_COL,
      ),

      new Paragraph({ ...sp(200, 0) }),
      h2('MongoDB — 6 collection linh hoạt', MG_COL),
      makeTable(
        ['Collection', 'Dữ liệu', 'Lý do dùng MongoDB'],
        [
          ['audit_logs', 'action, oldData (JSON), newData (JSON), diff[], userId, timestamp', 'JSON snapshot thay đổi — schema phụ thuộc loại action'],
          ['zalo_sessions', 'userId, state, lastQuery, expiredAt, context {}', 'TTL index, cấu trúc thay đổi theo state machine'],
          ['zalo_events', 'type, userId, payload {}, timestamp, processed', 'Event stream ghi nhanh, không cần JOIN'],
          ['report_cache', 'cacheKey, data {}, generatedAt, ttl', 'Kết quả aggregate phức tạp, schema tuỳ báo cáo'],
          ['notifications', 'channel, to, payload {}, sentAt, status', 'Payload Zalo message không có cấu trúc cố định'],
          ['search_index', 'householdId, tokens [], text, updatedAt', 'Full-text search — sync từ PostgreSQL khi có thay đổi'],
        ],
        [18, 42, 40],
        MG_COL,
      ),
      divider(),

      /* ── 3. KIẾN TRÚC 4 TẦNG ── */
      h1('3. KIẾN TRÚC HỆ THỐNG — 4 TẦNG'),
      makeTable(
        ['Tầng', 'Thành phần', 'Trách nhiệm'],
        [
          ['API Layer', 'Express Router (5 router files)', 'Nhận request, validate input, gọi service'],
          ['Service Layer', 'HouseholdService, ZaloService, AuditService, ReportService, SearchService', 'Business logic — điều phối cả 2 DB trong 1 transaction logic'],
          ['Repository Layer', 'PrismaClient (PG) + Mongoose (MG) — 2 client riêng biệt', 'Trừu tượng hoá DB — service không biết DB nào đằng sau'],
          ['Data Layer', 'PostgreSQL (Railway) + MongoDB Atlas — 2 connection độc lập', 'Lưu trữ — PG cho structured data, MG cho flexible data'],
        ],
        [12, 48, 40],
      ),

      new Paragraph({ ...sp(200, 100) }),
      h3('Nguyên tắc quan trọng:'),
      bullet('Service layer chịu trách nhiệm điều phối: luôn ghi PG trước, sau đó mới ghi MG (audit log)'),
      bullet('Nếu PG transaction fail → rollback, không ghi MG → dữ liệu nhất quán'),
      bullet('Nếu MG ghi audit fail → KHÔNG rollback PG (log là secondary, không block nghiệp vụ)'),
      bullet('Repository layer dùng interface pattern → có thể swap DB mà không sửa service'),
      divider(),

      /* ── 4. SCHEMA ── */
      h1('4. SCHEMA CHI TIẾT'),

      h2('PostgreSQL — Prisma Schema', PG_COL),
      codeBlock('model Village {'),
      codeBlock('  id          String      @id @default(cuid())'),
      codeBlock('  ma          String      @unique'),
      codeBlock('  ten         String'),
      codeBlock('  truongThon  String?'),
      codeBlock('  households  Household[]'),
      codeBlock('  admins      AdminUser[]  @relation("AdminVillages")'),
      codeBlock('}'),
      new Paragraph({ ...sp(80, 0) }),
      codeBlock('model Household {'),
      codeBlock('  id           String    @id @default(cuid())'),
      codeBlock('  soHoKhau     String    @unique'),
      codeBlock('  diaChi       String'),
      codeBlock('  lat          Float?'),
      codeBlock('  lng          Float?'),
      codeBlock('  trangThai    HoStatus  @default(ACTIVE)'),
      codeBlock('  loaiHo       HoType    @default(THUONG_TRU)'),
      codeBlock('  village      Village   @relation(fields:[villageId], references:[id])'),
      codeBlock('  villageId    String'),
      codeBlock('  members      Member[]'),
      codeBlock('  movements    MovementRecord[]'),
      codeBlock('  createdAt    DateTime  @default(now())'),
      codeBlock('  updatedAt    DateTime  @updatedAt'),
      codeBlock('}'),
      new Paragraph({ ...sp(80, 0) }),
      codeBlock('model Member {'),
      codeBlock('  id            String       @id @default(cuid())'),
      codeBlock('  hoTen         String'),
      codeBlock('  ngaySinh      DateTime?'),
      codeBlock('  gioiTinh      Gender'),
      codeBlock('  cccd          String?      @unique'),
      codeBlock('  sdt           String?'),
      codeBlock('  quanHeChuHo   String'),
      codeBlock('  laChuHo       Boolean      @default(false)'),
      codeBlock('  trangThai     MemberStatus @default(ACTIVE)'),
      codeBlock('  household     Household    @relation(fields:[householdId], references:[id])'),
      codeBlock('  householdId   String'),
      codeBlock('}'),
      new Paragraph({ ...sp(80, 0) }),
      codeBlock('model MovementRecord {'),
      codeBlock('  id            String         @id @default(cuid())'),
      codeBlock('  loai          MovementType   // MOVE_IN | MOVE_OUT'),
      codeBlock('  ngay          DateTime'),
      codeBlock('  nguonGoc      String?        // từ đâu (nếu MOVE_IN)'),
      codeBlock('  noiDen        String?        // đến đâu (nếu MOVE_OUT)'),
      codeBlock('  ghiChu        String?'),
      codeBlock('  household     Household      @relation(fields:[householdId], references:[id])'),
      codeBlock('  householdId   String'),
      codeBlock('  performedBy   AdminUser      @relation(fields:[performedById], references:[id])'),
      codeBlock('  performedById String'),
      codeBlock('}'),
      new Paragraph({ ...sp(80, 0) }),
      codeBlock('model HouseholdRelation {'),
      codeBlock('  id            String         @id @default(cuid())'),
      codeBlock('  type          RelationType   // SPLIT | MERGE'),
      codeBlock('  sourceId      String         // hộ gốc'),
      codeBlock('  targetId      String         // hộ tách ra / hộ nhận'),
      codeBlock('  memberIds     String[]       // thành viên chuyển'),
      codeBlock('  date          DateTime       @default(now())'),
      codeBlock('  note          String?'),
      codeBlock('}'),

      new Paragraph({ ...sp(200, 100) }),
      h2('MongoDB — Mongoose Schemas', MG_COL),
      codeBlock('// audit_logs — lưu TOÀN BỘ snapshot'),
      codeBlock('const AuditLogSchema = new Schema({'),
      codeBlock('  entityType : String,           // "household" | "member"'),
      codeBlock('  entityId   : String,           // PostgreSQL ID'),
      codeBlock('  action     : String,           // CREATE|UPDATE|DELETE|SPLIT|MERGE|MOVE_IN|MOVE_OUT'),
      codeBlock('  oldData    : Schema.Types.Mixed,  // snapshot trước (bất kỳ cấu trúc)'),
      codeBlock('  newData    : Schema.Types.Mixed,  // snapshot sau'),
      codeBlock('  diff       : [{ field, from, to }],'),
      codeBlock('  performedBy: String,           // AdminUser ID (từ PG)'),
      codeBlock('  performedAt: { type: Date, default: Date.now, index: true },'),
      codeBlock('  note       : String,'),
      codeBlock('}, { collection: "audit_logs" });'),
      new Paragraph({ ...sp(80, 0) }),
      codeBlock('// zalo_sessions — TTL tự xoá sau 30 phút'),
      codeBlock('const ZaloSessionSchema = new Schema({'),
      codeBlock('  zaloUserId  : { type: String, unique: true },'),
      codeBlock('  state       : String,          // IDLE|AWAIT_TYPE|AWAIT_QUERY|SHOWING'),
      codeBlock('  queryType   : String,          // "name"|"cccd"|"sdt"'),
      codeBlock('  lastQuery   : String,'),
      codeBlock('  resultCount : Number,'),
      codeBlock('  expiredAt   : { type: Date, expires: 0 },  // TTL index'),
      codeBlock('});'),
      new Paragraph({ ...sp(80, 0) }),
      codeBlock('// search_index — sync từ PG, phục vụ full-text'),
      codeBlock('const SearchIndexSchema = new Schema({'),
      codeBlock('  householdId : String,          // PostgreSQL ID'),
      codeBlock('  tokens      : [String],        // mảng từ khoá: họ tên, địa chỉ, thôn'),
      codeBlock('  chuHoName   : String,'),
      codeBlock('  villageName : String,'),
      codeBlock('  soHoKhau    : String,'),
      codeBlock('  updatedAt   : Date,'),
      codeBlock('});'),
      codeBlock('SearchIndexSchema.index({ tokens: "text", chuHoName: "text" });'),
      divider(),

      /* ── 5. WORKFLOW ── */
      h1('5. WORKFLOW CÁC NGHIỆP VỤ CHÍNH'),

      h2('5.1  Tạo hộ mới (UC01)'),
      makeTable(
        ['Bước', 'Hành động', 'DB', 'Ghi chú'],
        [
          ['1', 'Validate request: soHoKhau unique, villageId tồn tại', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, 'SELECT count(*) WHERE soHoKhau = ?'],
          ['2', 'INSERT INTO households + INSERT INTO members (batch)', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, 'Trong 1 transaction'],
          ['3', 'INSERT audit_logs { action: CREATE, newData: household }', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'Sau khi PG commit xong'],
          ['4', 'INSERT search_index { householdId, tokens[] }', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'Build token cho full-text search'],
          ['5', 'Return household data', '-', 'Lấy từ PostgreSQL'],
        ],
        [6, 46, 18, 30],
      ),

      new Paragraph({ ...sp(180, 80) }),
      h2('5.2  Cập nhật hộ (UC02)'),
      makeTable(
        ['Bước', 'Hành động', 'DB', 'Ghi chú'],
        [
          ['1', 'SELECT * FROM households WHERE id = ?  (lấy oldData)', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, 'Snapshot trước khi sửa'],
          ['2', 'BEGIN TRANSACTION', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['3', 'UPDATE households SET ... WHERE id = ?', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['4', 'UPDATE members SET ... (nếu có sửa thành viên)', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['5', 'COMMIT', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['6', 'computeDiff(oldData, newData) → diff[]', '-', 'Tính toán ở service layer'],
          ['7', 'INSERT audit_logs { UPDATE, oldData, newData, diff }', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'Ghi sau PG commit'],
          ['8', 'UPDATE search_index { tokens[] }', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'Cập nhật search cache'],
        ],
        [6, 44, 18, 32],
      ),

      new Paragraph({ ...sp(180, 80) }),
      h2('5.3  Tách hộ (UC05) — Phức tạp nhất'),
      note('Đây là nghiệp vụ quan trọng nhất cần 2 DB phối hợp: PG đảm bảo integrity, MG ghi lịch sử đầy đủ.'),
      makeTable(
        ['Bước', 'Hành động', 'DB', 'Ghi chú'],
        [
          ['1', 'Validate: memberIds thuộc hộ nguồn, newHeadId hợp lệ', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['2', 'BEGIN TRANSACTION', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['3', 'INSERT INTO households (hộ mới) → newHouseholdId', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['4', 'UPDATE members SET householdId = newHouseholdId, laChuHo = ... WHERE id IN (...)', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['5', 'UPDATE households SET trangThai = DA_TACH WHERE id = sourceId (nếu còn 0 thành viên)', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['6', 'INSERT INTO household_relations { type: SPLIT, sourceId, targetId: newId, memberIds }', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['7', 'COMMIT', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, ''],
          ['8', 'INSERT audit_logs x2: 1 cho hộ nguồn, 1 cho hộ mới', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'action=SPLIT'],
          ['9', 'INSERT search_index cho hộ mới', { text: 'MongoDB', bg: LMG, color: MG_COL }, ''],
          ['10', 'UPDATE search_index cho hộ nguồn', { text: 'MongoDB', bg: LMG, color: MG_COL }, ''],
        ],
        [6, 52, 18, 24],
      ),

      new Paragraph({ ...sp(180, 80) }),
      h2('5.4  Tra cứu Zalo OA (UC16) — Luồng 2 DB trong 1 request'),
      makeTable(
        ['Bước', 'Hành động', 'DB', 'Ghi chú'],
        [
          ['1', 'Webhook nhận tin nhắn từ Zalo → userId, text', '-', ''],
          ['2', 'GET zalo_sessions WHERE zaloUserId = userId', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'Lấy state hiện tại'],
          ['3', 'State machine xử lý: IDLE → AWAIT_TYPE', '-', 'Logic trong memory'],
          ['4', 'Người dùng chọn loại → AWAIT_QUERY, cập nhật session', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'UPSERT zalo_sessions'],
          ['5', 'Người dùng nhập query → tìm kiếm', '-', ''],
          ['6a', 'Nếu query text: $text search trong search_index', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'Full-text search nhanh'],
          ['6b', 'Lấy householdId từ MG → SELECT FROM households JOIN members WHERE id IN (...)', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, 'Lấy data chính xác từ PG'],
          ['6c', 'Nếu query CCCD/SĐT: WHERE members.cccd = ? (exact match)', { text: 'PostgreSQL', bg: LPG, color: PG_COL }, 'Index query, chính xác hơn'],
          ['7', 'INSERT zalo_events { type: SEARCH, userId, query, results }', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'Log tra cứu'],
          ['8', 'UPDATE zalo_sessions state → SHOWING_RESULT + TTL reset', { text: 'MongoDB', bg: LMG, color: MG_COL }, 'TTL 30 phút'],
          ['9', 'Format kết quả (chỉ: tên, thôn, số nhân khẩu)', '-', 'KHÔNG trả CCCD/SĐT'],
          ['10', 'Gọi Zalo API sendMessage()', '-', ''],
        ],
        [6, 52, 18, 24],
      ),
      divider(),

      /* ── 6. SERVICE CODE ── */
      h1('6. CODE PATTERN — SERVICE LAYER'),

      h2('HouseholdService.update() — điều phối 2 DB'),
      codeBlock('async updateHousehold(id, newData, performedById) {'),
      codeBlock('  // 1. Lấy snapshot từ PostgreSQL'),
      codeBlock('  const oldData = await this.pgRepo.findHouseholdById(id);'),
      codeBlock('  if (!oldData) throw new NotFoundError();'),
      codeBlock(''),
      codeBlock('  // 2. Cập nhật PostgreSQL (transaction)'),
      codeBlock('  const updated = await this.pgRepo.updateHousehold(id, newData);'),
      codeBlock(''),
      codeBlock('  // 3. Ghi audit log vào MongoDB (fire-and-forget — không block)'),
      codeBlock('  this.auditService.log({'),
      codeBlock('    entityType: "household",'),
      codeBlock('    entityId: id,'),
      codeBlock('    action: "UPDATE",'),
      codeBlock('    oldData,'),
      codeBlock('    newData: updated,'),
      codeBlock('    diff: computeDiff(oldData, updated),'),
      codeBlock('    performedBy: performedById,'),
      codeBlock('  }).catch(err => logger.error("Audit log failed", err)); // không throw'),
      codeBlock(''),
      codeBlock('  // 4. Sync search index (bất đồng bộ)'),
      codeBlock('  this.searchService.syncIndex(id).catch(() => {});'),
      codeBlock(''),
      codeBlock('  return updated;'),
      codeBlock('}'),

      new Paragraph({ ...sp(180, 80) }),
      h2('ZaloService.handleMessage() — Kết hợp MG → PG → MG'),
      codeBlock('async handleMessage(zaloUserId, text) {'),
      codeBlock('  // 1. Lấy state từ MongoDB'),
      codeBlock('  let session = await ZaloSession.findOne({ zaloUserId });'),
      codeBlock('  if (!session) session = { state: "IDLE" };'),
      codeBlock(''),
      codeBlock('  const { nextState, reply, query } = this.stateMachine(session, text);'),
      codeBlock(''),
      codeBlock('  let results = [];'),
      codeBlock('  if (query) {'),
      codeBlock('    if (query.type === "name") {'),
      codeBlock('      // Full-text: tìm trong MongoDB search_index trước'),
      codeBlock('      const ids = await SearchIndex.find({ $text: { $search: query.value } })'),
      codeBlock('                                    .select("householdId").lean();'),
      codeBlock('      // Lấy data đầy đủ từ PostgreSQL'),
      codeBlock('      results = await prisma.household.findMany({'),
      codeBlock('        where: { id: { in: ids.map(i => i.householdId) } },'),
      codeBlock('        include: { members: { where: { laChuHo: true } }, village: true },'),
      codeBlock('      });'),
      codeBlock('    } else {'),
      codeBlock('      // CCCD / SĐT: query trực tiếp PostgreSQL (exact match)'),
      codeBlock('      results = await prisma.household.findMany({'),
      codeBlock('        where: { members: { some: { [query.type]: query.value } } },'),
      codeBlock('        include: { members: true, village: true },'),
      codeBlock('      });'),
      codeBlock('    }'),
      codeBlock('  }'),
      codeBlock(''),
      codeBlock('  // Ghi log + cập nhật session vào MongoDB'),
      codeBlock('  await ZaloEvent.create({ type:"SEARCH", zaloUserId, query, resultCount: results.length });'),
      codeBlock('  await ZaloSession.updateOne({ zaloUserId }, { state: nextState }, { upsert: true });'),
      codeBlock(''),
      codeBlock('  return formatZaloReply(results); // chỉ trả tên + thôn + số nhân khẩu'),
      codeBlock('}'),
      divider(),

      /* ── 7. ĐỒNG BỘ 2 DB ── */
      h1('7. ĐỒNG BỘ DỮ LIỆU GIỮA 2 DB'),

      makeTable(
        ['Tình huống', 'Vấn đề', 'Giải pháp'],
        [
          ['PG update thành công, MG audit fail', 'Mất audit log', 'Retry queue: lưu task vào Redis, worker retry 3 lần'],
          ['Search index MG bị lỗi thời', 'Kết quả tìm kiếm không chính xác', 'Re-sync job chạy mỗi đêm; hoặc fallback tìm thẳng PG'],
          ['MG down hoàn toàn', 'Zalo state machine mất session', 'Fallback: lưu session vào Redis (trong-memory cache)'],
          ['PG down', 'Toàn bộ nghiệp vụ chính ngừng', 'Health check + alert; Railway auto-restart; read từ MG cache báo cáo'],
          ['Dữ liệu MG search_index không khớp PG', 'Tìm kiếm trả kết quả sai', 'Nightly full re-sync job; checksumming householdId'],
        ],
        [22, 35, 43],
      ),

      new Paragraph({ ...sp(200, 100) }),
      h3('Search Index Sync Strategy:'),
      bullet('Real-time sync: mỗi khi PG thay đổi household/member → async sync search_index trong MG'),
      bullet('Nightly full re-sync: job chạy 2:00 AM — rebuild toàn bộ search_index từ PG'),
      bullet('On-demand fallback: nếu search_index trả 0 kết quả → fallback LIKE query trực tiếp trên PG'),
      divider(),

      /* ── 8. KẾT NỐI & CONFIG ── */
      h1('8. CẤU HÌNH KẾT NỐI 2 DATABASE'),
      codeBlock('// src/config/database.js'),
      codeBlock('const { PrismaClient } = require("@prisma/client");'),
      codeBlock('const mongoose        = require("mongoose");'),
      codeBlock(''),
      codeBlock('const prisma = new PrismaClient({'),
      codeBlock('  datasources: { db: { url: process.env.DATABASE_URL } }, // PostgreSQL'),
      codeBlock('  log: process.env.NODE_ENV === "development" ? ["query"] : ["error"],'),
      codeBlock('});'),
      codeBlock(''),
      codeBlock('async function connectMongoDB() {'),
      codeBlock('  await mongoose.connect(process.env.MONGODB_URI, {'),
      codeBlock('    dbName: "hoa_tien",'),
      codeBlock('    maxPoolSize: 10,'),
      codeBlock('  });'),
      codeBlock('  console.log("MongoDB connected");'),
      codeBlock('}'),
      codeBlock(''),
      codeBlock('// server.js — khởi động song song'),
      codeBlock('await Promise.all(['),
      codeBlock('  prisma.$connect(),   // PostgreSQL'),
      codeBlock('  connectMongoDB(),    // MongoDB'),
      codeBlock(']);'),

      new Paragraph({ ...sp(180, 80) }),
      h3('Biến môi trường cần thiết:'),
      codeBlock('DATABASE_URL=postgresql://user:pass@railway.app:5432/hoa_tien'),
      codeBlock('MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/'),
      divider(),

      /* ── 9. TIMELINE ── */
      h1('9. KẾ HOẠCH TRIỂN KHAI'),
      makeTable(
        ['Sprint', 'Thời gian', 'Công việc', 'DB liên quan'],
        [
          ['Sprint 0', '3 ngày', 'Setup: Railway PG + MongoDB Atlas, Prisma init, Mongoose setup, Docker Compose dev', 'PG + MG'],
          ['Sprint 1', '1 tuần', 'Auth, CRUD Household + Member (PG), AuditService ghi MG, Search index sync', 'PG chính, MG audit'],
          ['Sprint 2', '1 tuần', 'Tách/Gộp hộ (PG transaction + MG log), Chuyển đến/đi, MovementRecord', 'PG + MG'],
          ['Sprint 3', '1 tuần', 'ZaloService: State machine dùng MG session, Full-text search (MG → PG)', 'MG session + PG data'],
          ['Sprint 4', '1 tuần', 'React Dashboard: Danh sách, form, tìm kiếm, lịch sử (đọc MG audit_logs)', 'PG + MG'],
          ['Sprint 5', '1 tuần', 'Report: thống kê PG, cache MG; Bản đồ Leaflet; Xuất Excel/PDF', 'PG aggregate + MG cache'],
          ['Sprint 6', '4 ngày', 'Re-sync job, Retry queue Redis, Health check 2 DB, E2E test', 'PG + MG + Redis'],
          ['Sprint 7', '3 ngày', 'Deploy Railway (PG) + Atlas (MG) + Render (API) + Vercel (Web)', 'Tất cả'],
        ],
        [10, 10, 55, 25],
      ),
      divider(),

      /* ── 10. TỔNG KẾT ── */
      h1('10. TỔNG KẾT LỢI ÍCH HYBRID ARCHITECTURE'),
      makeTable(
        ['Tiêu chí', '1 DB (chỉ PG hoặc MG)', 'Hybrid PG + MG', 'Lợi ích'],
        [
          ['Data integrity', 'Chỉ PG đảm bảo tốt', 'PG giữ toàn bộ dữ liệu cốt lõi', 'ACID đầy đủ cho nghiệp vụ chính'],
          ['Audit log', 'PG tốn dung lượng lớn (JSON trong PG)', 'MG lưu JSON snapshot không giới hạn schema', 'Tiết kiệm 60% storage PG'],
          ['Zalo session', 'PG cần TTL trigger phức tạp', 'MG TTL index tự xóa sau 30 phút', 'Đơn giản hóa code'],
          ['Full-text search', 'PG full-text search chậm hơn MG', 'MG text index tìm nhanh, fallback PG', 'Search nhanh hơn 3–5x'],
          ['Flexibility', 'PG cứng schema, migration phức tạp', 'MG cho phần thay đổi schema tự do', 'Thêm field log không cần migrate'],
          ['Reliability', 'Single point of failure', 'Nghiệp vụ chính (PG) độc lập MG', 'MG down không ảnh hưởng CRUD'],
        ],
        [18, 34, 28, 20],
      ),

      new Paragraph({ ...sp(300, 100) }),
      new Paragraph({
        children: [new TextRun({ text: '— Hết tài liệu kế hoạch Hybrid Database —', italics: true, size: 22, color: '9ca3af' })],
        alignment: AlignmentType.CENTER,
      }),
    ],
  }],
});

const outPath = path.join(__dirname, '..', 'data', 'KeHoach_HybridDB_PostgreSQL_MongoDB.docx');
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log('✅ Word file:', outPath);
});
