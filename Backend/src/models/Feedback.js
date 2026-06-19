const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId:         { type: String, required: true, index: true },
  displayName:    { type: String, default: '' },
  contact:        { type: String, required: true },
  content:        { type: String, required: true },
  imageUrl:       { type: String, default: '' },
  imageUrls:      [{ type: String }],
  categoryId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  // pending = mới / đang xử lý, draft = dự thảo chờ duyệt, resolved = đã gửi dân
  status:         { type: String, enum: ['pending', 'draft', 'resolved', 'processing', 'done'], default: 'pending' },
  createdAt:      { type: Date, default: Date.now },
  deadline:       { type: Date, default: null },
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  assignedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  // Dự thảo
  draftResponse:  { type: String, default: '' },
  draftBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  draftAt:        { type: Date, default: null },
  // Duyệt / Từ chối
  approvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  rejectedReason: { type: String, default: '' },
  // Phản hồi cuối gửi dân
  finalResponse:  { type: String, default: '' },
  sentAt:         { type: Date, default: null },
  // Legacy fields giữ tương thích
  response:       { type: String, default: '' },
  respondedAt:    { type: Date, default: null },
  respondedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
  note:           { type: String, default: '' },
  updatedAt:      { type: Date, default: null },
});

module.exports = mongoose.model('Feedback', feedbackSchema);
