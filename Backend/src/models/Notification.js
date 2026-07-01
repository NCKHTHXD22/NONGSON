const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true, index: true },
  type:       { type: String, enum: ['assigned', 'draft_submitted'], required: true },
  feedbackId: { type: mongoose.Schema.Types.ObjectId, ref: 'Feedback', required: true },
  message:    { type: String, required: true },
  isRead:     { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', notificationSchema);
