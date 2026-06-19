const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, convertInchesToTwip,
  PageOrientation, Header, Footer, PageNumber,
  NumberFormat, TableOfContents, StyleLevel,
  UnderlineType, VerticalAlign,
} = require('docx');
const fs = require('fs');
const path = require('path');

const BLUE   = '1e40af';
const LBLUE  = 'dbeafe';
const GREEN  = '166534';
const LGREEN = 'dcfce7';
const ORANGE = '9a3412';
const LORAN  = 'fff7ed';
const GRAY   = '374151';
const LGRAY  = 'f9fafb';
const WHITE  = 'FFFFFF';

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    shading: { type: ShadingType.SOLID, color: LBLUE, fill: LBLUE },
    indent: { left: convertInchesToTwip(0.1) },
  });
}

function h2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
  });
}

function h3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 24, color: GRAY, ...opts })],
    spacing: { after: 120 },
  });
}

function bold(text, color = BLUE) {
  return new TextRun({ text, bold: true, size: 24, color });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: GRAY })],
    bullet: { level },
    spacing: { after: 80 },
  });
}

function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cccccc' } },
    spacing: { before: 200, after: 200 },
  });
}

function makeTable(headers, rows, colWidths) {
  const headerCells = headers.map((h, i) =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, size: 20, color: WHITE })],
        alignment: AlignmentType.CENTER,
      })],
      shading: { type: ShadingType.SOLID, color: BLUE, fill: BLUE },
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    })
  );

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map((cell, ci) =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: String(cell), size: 20, color: GRAY })],
          })],
          shading: {
            type: ShadingType.SOLID,
            color: ri % 2 === 0 ? WHITE : LGRAY,
            fill: ri % 2 === 0 ? WHITE : LGRAY,
          },
          width: { size: colWidths[ci], type: WidthType.PERCENTAGE },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        })
      ),
    })
  );

  return new Table({
    rows: [new TableRow({ children: headerCells, tableHeader: true }), ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 100 },
  });
}

function codeBlock(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Courier New', size: 18, color: '1e293b' })],
    shading: { type: ShadingType.SOLID, color: 'f1f5f9', fill: 'f1f5f9' },
    spacing: { before: 80, after: 80 },
    indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
  });
}

const doc = new Document({
  styles: {
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal',
        run: { size: 32, bold: true, color: BLUE, font: 'Calibri' },
        paragraph: { spacing: { before: 360, after: 180 } },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal',
        run: { size: 26, bold: true, color: '1d4ed8' },
        paragraph: { spacing: { before: 240, after: 120 } },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal',
        run: { size: 22, bold: true, color: GRAY },
        paragraph: { spacing: { before: 160, after: 80 } },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) },
          margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1) },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                bold('HỆ THỐNG QUẢN LÝ HỘ DÂN XÃ HOA TIẾN', BLUE),
                new TextRun({ text: '  |  Tài liệu thiết kế hệ thống', size: 20, color: '6b7280' }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e5e7eb' } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Trang ', size: 18, color: '9ca3af' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '9ca3af' }),
                new TextRun({ text: ' / ', size: 18, color: '9ca3af' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '9ca3af' }),
                new TextRun({ text: '          Ngày lập: 06/06/2026          Vo Nguyen An', size: 18, color: '9ca3af' }),
              ],
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'e5e7eb' } },
            }),
          ],
        }),
      },
      children: [
        // ── TRANG BÌA ─────────────────────────────────────────────
        new Paragraph({
          children: [new TextRun({ text: '', break: 4 })],
        }),
        new Paragraph({
          children: [bold('UBND XÃ HOA TIẾN', '6b7280')],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({ text: '─────────────────────────────────────', color: 'e5e7eb', size: 28 })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: 'KẾ HOẠCH XÂY DỰNG', bold: true, size: 52, color: BLUE })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 300, after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'HỆ THỐNG QUẢN LÝ THÔNG TIN\nCHỦ HỘ CÁC THÔN THUỘC XÃ HOA TIẾN', bold: true, size: 36, color: '1e40af' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Tích hợp Zalo OA — Tra cứu hộ khẩu cho người dân', italics: true, size: 24, color: '6b7280' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Phiên bản: 1.0     |     Ngày: 06/06/2026', size: 22, color: '9ca3af' })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ children: [new TextRun({ text: '', break: 8 })] }),

        // ── 1. TỔNG QUAN ──────────────────────────────────────────
        h1('1. TỔNG QUAN DỰ ÁN'),
        p('Hệ thống quản lý thông tin chủ hộ dân cho xã Hoa Tiến — cho phép cán bộ xã/thôn quản lý toàn bộ hồ sơ hộ gia đình (thêm, sửa, xóa, tách/gộp hộ, biến động dân cư), tra cứu nhanh, thống kê báo cáo và tích hợp Zalo OA để người dân tự tra cứu thông tin.'),
        divider(),

        // ── 2. USE CASES ──────────────────────────────────────────
        h1('2. DANH SÁCH USE CASE'),
        makeTable(
          ['ID', 'Nhóm', 'Tên Use Case', 'Mô tả'],
          [
            ['UC01', 'Quản lý hồ sơ', 'Thêm chủ hộ', 'Tạo mới hồ sơ chủ hộ'],
            ['UC02', 'Quản lý hồ sơ', 'Cập nhật chủ hộ', 'Chỉnh sửa thông tin chủ hộ'],
            ['UC03', 'Quản lý hồ sơ', 'Xóa chủ hộ', 'Xóa hồ sơ khi không còn hiệu lực'],
            ['UC04', 'Quản lý gia đình', 'Quản lý thành viên', 'Thêm / sửa / xóa thành viên hộ'],
            ['UC05', 'Quản lý gia đình', 'Tách hộ', 'Tách hộ gia đình thành 2 hộ mới'],
            ['UC06', 'Quản lý gia đình', 'Gộp hộ', 'Gộp 2 hộ gia đình thành 1'],
            ['UC07', 'Biến động dân cư', 'Chuyển đến', 'Cập nhật hộ chuyển đến xã'],
            ['UC08', 'Biến động dân cư', 'Chuyển đi', 'Cập nhật hộ chuyển đi'],
            ['UC09', 'Tra cứu', 'Tìm kiếm', 'Tra cứu theo tên, CCCD, SĐT'],
            ['UC10', 'Địa bàn', 'Quản lý thôn', 'Quản lý danh mục thôn'],
            ['UC11', 'Thống kê', 'Báo cáo hộ dân', 'Thống kê số hộ, nhân khẩu'],
            ['UC12', 'Thống kê', 'Xuất báo cáo', 'Xuất Excel / PDF'],
            ['UC13', 'Phân quyền', 'Phân quyền user', 'Quản lý vai trò xã/thôn'],
            ['UC14', 'Bản đồ số', 'Hiển thị bản đồ', 'Hiển thị hộ dân theo địa bàn'],
            ['UC15', 'Lịch sử', 'Theo dõi lịch sử', 'Lưu vết cập nhật dữ liệu'],
            ['UC16*', 'Zalo OA', 'Tra cứu Zalo', 'Người dân tra cứu hộ khẩu qua Zalo OA'],
          ],
          [8, 20, 22, 50]
        ),
        p('*UC16 bổ sung thêm để đáp ứng tích hợp Zalo OA.', { italics: true, color: '6b7280' }),
        divider(),

        // ── 3. PHƯƠNG ÁN CÔNG NGHỆ ──────────────────────────────
        h1('3. HAI PHƯƠNG ÁN CÔNG NGHỆ'),

        h2('Phương án A — JavaScript / MongoDB'),
        makeTable(
          ['Tầng', 'Công nghệ', 'Lý do chọn'],
          [
            ['Backend', 'Node.js + Express.js (JavaScript)', 'Nhẹ, nhanh, tích hợp Zalo dễ'],
            ['Database', 'MongoDB + Mongoose', 'Schema linh hoạt, nested documents'],
            ['Cache', 'Redis (Upstash)', 'Session, rate-limit, Zalo token'],
            ['Frontend', 'React 19 + Vite + Tailwind CSS', 'SPA nhanh, component-based'],
            ['UI', 'Ant Design hoặc shadcn/ui', 'Table lớn, form phức tạp'],
            ['Auth', 'JWT (jsonwebtoken)', 'Stateless, dễ scale'],
            ['Export', 'exceljs + pdfkit', 'Excel / PDF báo cáo'],
            ['Bản đồ', 'Leaflet.js + OpenStreetMap', 'Miễn phí, embed được'],
            ['Deploy', 'Render (backend) + Vercel (frontend)', 'Phù hợp dự án nhỏ-vừa'],
          ],
          [15, 40, 45]
        ),
        new Paragraph({
          children: [
            new TextRun({ text: 'Ưu điểm: ', bold: true, size: 22, color: GREEN }),
            new TextRun({ text: 'Nhanh xây dựng, linh hoạt schema, phù hợp team nhỏ. ', size: 22, color: GRAY }),
            new TextRun({ text: 'Nhược điểm: ', bold: true, size: 22, color: ORANGE }),
            new TextRun({ text: 'Thiếu type-safety, quan hệ dữ liệu nhiều-nhiều cồng kềnh.', size: 22, color: GRAY }),
          ],
          spacing: { before: 120, after: 200 },
        }),

        h2('Phương án B — TypeScript / PostgreSQL'),
        makeTable(
          ['Tầng', 'Công nghệ', 'Lý do chọn'],
          [
            ['Backend', 'NestJS + TypeScript', 'Decorator, DI container, module hóa'],
            ['Database', 'PostgreSQL + Prisma ORM', 'ACID, full-text search native, quan hệ rõ'],
            ['Cache', 'Redis (Railway / Upstash)', 'Session, cache query, Zalo token'],
            ['Frontend', 'Next.js 14 + TypeScript + Tailwind', 'SSR/SSG, SEO, type-safe'],
            ['UI', 'Mantine hoặc shadcn/ui', 'DatePicker, Table, Modal đầy đủ'],
            ['Auth', 'JWT + Passport.js', 'Middleware chuẩn NestJS'],
            ['Export', 'exceljs + Puppeteer (PDF)', 'PDF layout đẹp hơn pdfkit'],
            ['Bản đồ', 'Leaflet.js + OpenStreetMap / MapLibre', 'Vector tiles, hiệu năng cao'],
            ['Deploy', 'Railway (backend + DB) + Vercel', 'PostgreSQL managed trên Railway'],
          ],
          [15, 40, 45]
        ),
        new Paragraph({
          children: [
            new TextRun({ text: 'Ưu điểm: ', bold: true, size: 22, color: GREEN }),
            new TextRun({ text: 'Type-safe end-to-end, migration rõ ràng, query phức tạp mạnh hơn. ', size: 22, color: GRAY }),
            new TextRun({ text: 'Nhược điểm: ', bold: true, size: 22, color: ORANGE }),
            new TextRun({ text: 'Boilerplate nhiều, learning curve NestJS nếu team chưa biết.', size: 22, color: GRAY }),
          ],
          spacing: { before: 120, after: 200 },
        }),

        new Paragraph({
          children: [
            new TextRun({ text: 'KHUYẾN NGHỊ: ', bold: true, size: 24, color: BLUE }),
            new TextRun({ text: 'Nếu team đã quen Node.js/Express/MongoDB → Chọn Phương án A. Nếu cần hệ thống dài hạn, quan hệ dữ liệu phức tạp → Chọn Phương án B.', size: 24, color: GRAY }),
          ],
          shading: { type: ShadingType.SOLID, color: LBLUE, fill: LBLUE },
          spacing: { before: 200, after: 200 },
          indent: { left: convertInchesToTwip(0.15) },
        }),
        divider(),

        // ── 4. KIẾN TRÚC HỆ THỐNG ───────────────────────────────
        h1('4. KIẾN TRÚC HỆ THỐNG'),
        h2('4.1 Request Flow'),
        codeBlock('Người dân (Zalo) → POST /webhook → webhookHandler.js → Household API → DB → trả kết quả'),
        codeBlock('Cán bộ (Browser) → React SPA → GET|POST /api/* (JWT) → api/routes/*.js → MongoDB/PostgreSQL'),

        h2('4.2 Các tầng kiến trúc'),
        makeTable(
          ['Tầng', 'Thành phần', 'Vai trò'],
          [
            ['Presentation', 'React 19 SPA (Vite + Tailwind)', 'Giao diện người dùng, gọi REST API'],
            ['Zalo OA', 'Webhook + State Machine', 'Nhận & xử lý tin nhắn Zalo từ người dân'],
            ['API Gateway', 'Express Router + CORS + Rate Limit', 'Điều phối request, bảo vệ endpoint'],
            ['Business Logic', 'Service Layer (householdService, searchService...)', 'Xử lý nghiệp vụ: tách/gộp hộ, biến động'],
            ['Auth & Auth', 'JWT + RBAC Middleware', 'Xác thực danh tính, phân quyền theo role'],
            ['Data Access', 'Mongoose (PA-A) / Prisma (PA-B)', 'ORM, schema validation, query builder'],
            ['Persistence', 'MongoDB Atlas / PostgreSQL + Redis', 'Lưu trữ dữ liệu, cache, token'],
            ['Audit', 'Audit Middleware (auto-log)', 'Tự động ghi lịch sử mọi thay đổi'],
            ['File Export', 'exceljs + pdfkit / puppeteer', 'Xuất báo cáo Excel, PDF'],
            ['Map', 'Leaflet.js + OpenStreetMap + Geocoding', 'Hiển thị hộ dân trên bản đồ'],
          ],
          [18, 38, 44]
        ),
        divider(),

        // ── 5. DATA MODEL ─────────────────────────────────────────
        h1('5. DATA MODEL CHI TIẾT'),
        h2('5.1 Household (Hộ gia đình)'),
        makeTable(
          ['Trường', 'Kiểu', 'Mô tả'],
          [
            ['soHoKhau', 'String (unique)', 'Số sổ hộ khẩu'],
            ['chuHo.hoTen', 'String', 'Họ tên chủ hộ'],
            ['chuHo.cccd', 'String', 'CCCD / CMND chủ hộ'],
            ['chuHo.sdt', 'String', 'Số điện thoại'],
            ['chuHo.ngaySinh', 'Date', 'Ngày sinh chủ hộ'],
            ['thanhVien', 'Array<Member>', 'Danh sách thành viên hộ'],
            ['thon', 'ObjectId → Village', 'Thôn trực thuộc'],
            ['diaChi', 'String', 'Địa chỉ cụ thể trong thôn'],
            ['toaDo', '{ lat, lng }', 'Tọa độ GPS cho bản đồ'],
            ['trangThai', 'Enum', 'active | da_chuyen_di | da_gop | da_tach'],
            ['loaiHo', 'Enum', 'thuong_tru | tam_tru | khai_sinh'],
            ['createdBy / updatedBy', 'ObjectId → AdminUser', 'Người tạo / cập nhật'],
          ],
          [28, 25, 47]
        ),

        h2('5.2 AuditLog (Lịch sử thay đổi)'),
        makeTable(
          ['Trường', 'Kiểu', 'Mô tả'],
          [
            ['householdId', 'ObjectId', 'Hộ bị thay đổi'],
            ['action', 'Enum', 'create | update | delete | split | merge | move_in | move_out'],
            ['oldData', 'Object', 'Snapshot dữ liệu trước khi thay đổi'],
            ['newData', 'Object', 'Snapshot dữ liệu sau khi thay đổi'],
            ['changedFields', 'Array<String>', 'Danh sách field bị thay đổi'],
            ['performedBy', 'ObjectId → AdminUser', 'Người thực hiện'],
            ['performedAt', 'Date', 'Thời điểm thay đổi'],
            ['note', 'String', 'Ghi chú (lý do tách/gộp/chuyển...)'],
          ],
          [28, 30, 42]
        ),
        divider(),

        // ── 6. PHÂN QUYỀN ─────────────────────────────────────────
        h1('6. PHÂN QUYỀN (UC13)'),
        makeTable(
          ['Role', 'Quyền hạn', 'Phạm vi'],
          [
            ['superadmin', 'Toàn quyền: CRUD tất cả, quản lý user', 'Toàn xã + cấu hình hệ thống'],
            ['xa_admin', 'Xem + sửa tất cả hộ trong xã', 'Toàn xã, không quản lý user superadmin'],
            ['thon_admin', 'CRUD hộ thuộc thôn được gán', 'Chỉ thôn trong villageIds[]'],
            ['viewer', 'Chỉ xem (read-only), tìm kiếm', 'Không sửa, không export'],
          ],
          [18, 52, 30]
        ),
        divider(),

        // ── 7. ZALO OA ────────────────────────────────────────────
        h1('7. TÍCH HỢP ZALO OA (UC16)'),
        h2('7.1 Luồng tra cứu'),
        bullet('Người dân nhắn tin "tra cứu hộ khẩu" vào Zalo OA xã Hoa Tiến'),
        bullet('Bot hiển thị menu: [1] Theo họ tên  [2] Theo CCCD  [3] Theo SĐT'),
        bullet('Người dân chọn và nhập thông tin cần tìm'),
        bullet('Webhook nhận → State Machine xử lý → gọi Household API (internal)'),
        bullet('Trả kết quả: Tên chủ hộ, Thôn, Số nhân khẩu, Trạng thái'),
        bullet('KHÔNG trả CCCD, SĐT trong kết quả để bảo mật thông tin'),

        h2('7.2 Bảo mật Zalo'),
        makeTable(
          ['Biện pháp', 'Chi tiết'],
          [
            ['Rate limit', 'Tối đa 5 tra cứu / người / ngày'],
            ['Dữ liệu trả về', 'Chỉ trả: tên, thôn, số nhân khẩu — không trả CCCD/SĐT'],
            ['Audit log', 'Ghi log mọi lần tra cứu qua Zalo (userId, thời điểm, query)'],
            ['Zalo token', 'Auto-refresh token 25h trước khi hết hạn, lưu Redis'],
          ],
          [30, 70]
        ),
        divider(),

        // ── 8. API ENDPOINTS ──────────────────────────────────────
        h1('8. API ENDPOINTS'),
        h2('8.1 Auth'),
        codeBlock('POST   /api/auth/login              → Đăng nhập, trả JWT'),
        codeBlock('POST   /api/auth/logout             → Hủy session'),
        codeBlock('GET    /api/auth/me                 → Thông tin user hiện tại'),

        h2('8.2 Hộ gia đình'),
        codeBlock('GET    /api/households              → Danh sách hộ (filter, paginate)'),
        codeBlock('POST   /api/households              → UC01: Thêm hộ mới'),
        codeBlock('GET    /api/households/:id          → Chi tiết hộ'),
        codeBlock('PUT    /api/households/:id          → UC02: Cập nhật hộ'),
        codeBlock('DELETE /api/households/:id          → UC03: Xóa/vô hiệu hóa hộ'),
        codeBlock('POST   /api/households/:id/members  → UC04: Thêm thành viên'),
        codeBlock('POST   /api/households/:id/split    → UC05: Tách hộ'),
        codeBlock('POST   /api/households/merge        → UC06: Gộp hộ'),
        codeBlock('POST   /api/households/:id/move-in  → UC07: Chuyển đến'),
        codeBlock('POST   /api/households/:id/move-out → UC08: Chuyển đi'),

        h2('8.3 Thống kê & Xuất báo cáo'),
        codeBlock('GET    /api/stats/overview          → Tổng hộ, nhân khẩu toàn xã'),
        codeBlock('GET    /api/stats/by-village        → Thống kê theo thôn'),
        codeBlock('GET    /api/export/excel            → Xuất Excel danh sách hộ'),
        codeBlock('GET    /api/export/pdf              → Xuất PDF báo cáo tổng hợp'),
        divider(),

        // ── 9. FRONTEND SCREENS ───────────────────────────────────
        h1('9. CÁC MÀN HÌNH FRONTEND'),
        makeTable(
          ['Route', 'Màn hình', 'Use Case'],
          [
            ['/login', 'Đăng nhập', 'Auth'],
            ['/dashboard', 'Tổng quan: số hộ, nhân khẩu, biến động', 'UC11'],
            ['/households', 'Danh sách hộ (filter theo thôn, trạng thái)', 'UC01-04'],
            ['/households/new', 'Form thêm hộ mới', 'UC01'],
            ['/households/:id', 'Chi tiết hộ + thành viên + lịch sử', 'UC02, UC15'],
            ['/households/split/:id', 'Màn hình tách hộ', 'UC05'],
            ['/households/merge', 'Màn hình gộp hộ', 'UC06'],
            ['/search', 'Tìm kiếm nâng cao', 'UC09'],
            ['/villages', 'Quản lý danh mục thôn', 'UC10'],
            ['/map', 'Bản đồ hộ dân theo địa bàn', 'UC14'],
            ['/reports', 'Báo cáo + xuất Excel/PDF', 'UC11, UC12'],
            ['/audit-logs', 'Lịch sử thay đổi toàn hệ thống', 'UC15'],
            ['/users', 'Quản lý người dùng & phân quyền', 'UC13'],
          ],
          [28, 48, 24]
        ),
        divider(),

        // ── 10. KẾ HOẠCH TRIỂN KHAI ──────────────────────────────
        h1('10. KẾ HOẠCH TRIỂN KHAI — TIMELINE'),
        makeTable(
          ['Sprint', 'Thời gian', 'Công việc chính', 'Kết quả'],
          [
            ['Sprint 0', '3 ngày', 'Setup repo, DB, CI/CD, Docker Compose', 'Môi trường dev sẵn sàng'],
            ['Sprint 1', '1 tuần', 'Auth module, CRUD Household + Member', 'API cơ bản hoạt động'],
            ['Sprint 2', '1 tuần', 'Tách/Gộp hộ, Chuyển đến/đi, Search, Audit Log', 'Nghiệp vụ phức tạp xong'],
            ['Sprint 3', '1 tuần', 'React Dashboard, Form hộ, Danh sách, Tìm kiếm', 'Frontend cơ bản hoạt động'],
            ['Sprint 4', '1 tuần', 'Tách/Gộp hộ UI, Thống kê, Xuất Excel/PDF, Phân quyền', 'Frontend đầy đủ'],
            ['Sprint 5', '1 tuần', 'Bản đồ Leaflet, Geocoding, Zalo OA webhook', 'Zalo tra cứu được'],
            ['Sprint 6', '4 ngày', 'Lịch sử thay đổi UI, Performance, Testing E2E', 'Hệ thống ổn định'],
            ['Sprint 7', '3 ngày', 'Deploy Render + Vercel, SSL, Production Zalo webhook', 'Go-live'],
          ],
          [12, 12, 48, 28]
        ),
        new Paragraph({
          children: [
            bold('Tổng thời gian ước tính: ', BLUE),
            new TextRun({ text: '6–7 tuần (1 người full-time)', size: 24, color: GRAY }),
          ],
          spacing: { before: 200, after: 200 },
        }),
        divider(),

        // ── 11. RỦI RO ────────────────────────────────────────────
        h1('11. ĐIỂM CẦN LƯU Ý & RỦI RO'),
        makeTable(
          ['#', 'Rủi ro', 'Giải pháp'],
          [
            ['1', 'Dữ liệu nhạy cảm (CCCD, địa chỉ)', 'Mã hóa fields nhạy cảm, HTTPS bắt buộc, audit log'],
            ['2', 'Zalo OA trả lộ thông tin cá nhân', 'Chỉ trả tên + thôn; thêm xác thực người hỏi'],
            ['3', 'Import dữ liệu cũ từ Excel', 'Build tool import + validate trước khi insert'],
            ['4', 'Địa chỉ không chuẩn hóa', 'Dropdown thôn bắt buộc; tự do nhập thêm địa chỉ chi tiết'],
            ['5', 'Mất điện/mạng → mất dữ liệu', 'MongoDB Atlas / PostgreSQL managed — backup tự động'],
            ['6', 'Nhiều cán bộ sửa cùng lúc', 'Optimistic concurrency (updatedAt check)'],
          ],
          [5, 40, 55]
        ),
        divider(),

        // ── 12. CÔNG CỤ ───────────────────────────────────────────
        h1('12. CÔNG CỤ HỖ TRỢ PHÁT TRIỂN'),
        makeTable(
          ['Mục đích', 'Công cụ đề xuất'],
          [
            ['Version control', 'Git + GitHub'],
            ['API testing', 'Postman / Thunder Client (VS Code extension)'],
            ['DB GUI', 'MongoDB Compass (PA-A) / TablePlus (PA-B)'],
            ['Containerization', 'Docker + Docker Compose (môi trường dev đồng nhất)'],
            ['CI/CD', 'GitHub Actions (auto test + deploy khi push)'],
            ['Error monitoring', 'Sentry (frontend) + Better Stack (backend logs)'],
            ['API documentation', 'Swagger UI (NestJS tự gen) / swagger-ui-express (Express)'],
            ['Import dữ liệu', 'Script Node.js đọc Excel (exceljs) → validate → insert MongoDB/PG'],
          ],
          [30, 70]
        ),

        new Paragraph({ children: [new TextRun({ text: '', break: 2 })] }),
        new Paragraph({
          children: [new TextRun({ text: '— Hết tài liệu kế hoạch —', italics: true, size: 22, color: '9ca3af' })],
          alignment: AlignmentType.CENTER,
        }),
      ],
    },
  ],
});

const outDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'KeHoach_HoaDan_HoaTien.docx');

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log('✅ Word file created:', outPath);
});
