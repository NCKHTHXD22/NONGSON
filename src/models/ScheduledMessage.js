const mongoose = require('mongoose');

const scheduledMessageSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  adminNote: { type: String, default: '' },
  attachmentIds: { type: [String], default: [] },
  videoAttachmentId: { type: String, default: null },
  fileAttachmentId: { type: String, default: null },
  linkUrl: { type: String, default: '' },
  linkTitle: { type: String, default: '' },
  userIds: { type: [String], default: [] },
  groupIds: { type: [String], default: [] },
  scheduledAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'sending', 'done', 'failed', 'cancelled'],
    default: 'pending',
  },
  createdBy: { type: String, default: '' },
  jobId: { type: String, default: null },
  error: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ScheduledMessage', scheduledMessageSchema);
