const cron = require('node-cron');
const ScheduledMessage = require('../models/ScheduledMessage');
const { sendToUsers } = require('./broadcastService');

// Reset các job bị stuck ở 'sending' khi server khởi động lại
async function resetStuckJobs() {
  try {
    const result = await ScheduledMessage.updateMany(
      { status: 'sending' },
      { status: 'failed', error: 'Server khởi động lại khi đang gửi' }
    );
    if (result.modifiedCount > 0) {
      console.log(`[Scheduler] Reset ${result.modifiedCount} job bị stuck`);
    }
  } catch (err) {
    console.error('[Scheduler] Lỗi reset stuck jobs:', err.message);
  }
}

async function runPendingJobs() {
  const now = new Date();
  let pending;
  try {
    pending = await ScheduledMessage.find({
      status: 'pending',
      scheduledAt: { $lte: now },
    }).lean();
  } catch (err) {
    console.error('[Scheduler] Lỗi query:', err.message);
    return;
  }

  for (const msg of pending) {
    // Đánh dấu đang gửi ngay để tránh gửi 2 lần nếu cron chồng nhau
    const updated = await ScheduledMessage.findOneAndUpdate(
      { _id: msg._id, status: 'pending' },
      { status: 'sending' },
      { new: true }
    );
    if (!updated) continue; // job đã bị grab bởi instance khác

    console.log(`[Scheduler] Bắt đầu gửi lịch: ${msg.title || msg._id}`);

    const allRecipients = [
      ...(msg.userIds || []),
      ...(msg.groupIds || []).map(g => `g:${g}`),
    ];

    try {
      const jobId = await sendToUsers(
        allRecipients,
        msg.message,
        {
          attachmentIds: msg.attachmentIds || [],
          videoAttachmentId: msg.videoAttachmentId || null,
          fileAttachmentId: msg.fileAttachmentId || null,
        },
        msg.adminNote,
        msg.linkUrl,
        msg.linkTitle
      );
      await ScheduledMessage.findByIdAndUpdate(msg._id, { status: 'done', jobId });
      console.log(`[Scheduler] Đã gửi lịch: ${msg.title || msg._id}, jobId=${jobId}`);
    } catch (err) {
      console.error(`[Scheduler] Lỗi gửi lịch ${msg._id}:`, err.message);
      await ScheduledMessage.findByIdAndUpdate(msg._id, {
        status: 'failed',
        error: err.message,
      });
    }
  }
}

function start() {
  resetStuckJobs();
  // Kiểm tra mỗi phút
  cron.schedule('* * * * *', runPendingJobs);
  console.log('[Scheduler] Đã khởi động, kiểm tra mỗi phút');
}

module.exports = { start };
