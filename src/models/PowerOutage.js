const mongoose = require('mongoose');

// Lịch tạm ngừng cung cấp điện (EVNCPC) — khu vực Điện lực Nong Son
const powerOutageSchema = new mongoose.Schema({
  subOrgCode:   { type: String, default: '' },   // mã đơn vị điện lực (vd PC05MM)
  subOrgName:   { type: String, default: '' },   // tên đơn vị (vd "Điện lực Nong Son")
  stationCode:  { type: String, default: '' },   // mã trạm
  stationName:  { type: String, default: '' },   // tên trạm / khu vực
  fromDate:     { type: Date, required: true },  // bắt đầu cắt
  toDate:       { type: Date, required: true },  // kết thúc
  fromDateStr:  { type: String, default: '' },   // hiển thị "HH:mm dd/MM/yyyy"
  toDateStr:    { type: String, default: '' },
  outageType:   { type: String, default: '' },   // "Sự cố" | "Theo kế hoạch"
  statusStr:    { type: String, default: '' },   // "Đã duyệt" ...
  reason:       { type: String, default: '' },   // lý do
  crawledAt:    { type: Date, default: Date.now },
});

// Chống trùng khi cào lại: 1 trạm + 1 khung giờ = 1 bản ghi
powerOutageSchema.index({ stationCode: 1, fromDate: 1, toDate: 1 }, { unique: true });

module.exports = mongoose.model('PowerOutage', powerOutageSchema);
