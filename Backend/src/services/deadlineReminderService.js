const Feedback = require('../models/Feedback');
const AdminUser = require('../models/AdminUser');
const { sendZaloText } = require('../utils/zaloApi');

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const REMINDER_COOLDOWN_MS = 20 * 60 * 60 * 1000;

async function runDeadlineReminders() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const cooldownThreshold = new Date(now.getTime() - REMINDER_COOLDOWN_MS);

    const feedbacks = await Feedback.find({
      status: { $nin: ['resolved', 'done'] },
      deadline: { $lte: in24h },
      assignedTo: { $ne: null },
      $or: [
        { lastReminderSentAt: null },
        { lastReminderSentAt: { $lte: cooldownThreshold } },
      ],
    })
      .populate('assignedTo', 'fullName zaloUserId')
      .populate('categoryId', 'name')
      .lean();

    for (const fb of feedbacks) {
      const officer = fb.assignedTo;
      if (!officer?.zaloUserId) continue;

      const shortCode = fb._id.toString().slice(-5).toUpperCase();
      const deadline = new Date(fb.deadline);
      const deadlineStr = deadline.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const isOverdue = deadline < now;

      const msg =
        `⏰ NHẮC LỊCH XỬ LÝ HỒ SƠ\n` +
        `${'─'.repeat(28)}\n` +
        `🆔 Mã phản ánh: #${shortCode}\n` +
        `📂 Loại: ${fb.categoryId?.name || ''}\n` +
        `📝 Nội dung: ${fb.content.slice(0, 80)}${fb.content.length > 80 ? '...' : ''}\n` +
        `📅 Hạn xử lý: ${deadlineStr}${isOverdue ? ' ⚠️ ĐÃ QUÁ HẠN' : ''}\n\n` +
        `Vui lòng đăng nhập hệ thống để xử lý kịp thời.`;

      await sendZaloText(officer.zaloUserId, msg);
      await Feedback.findByIdAndUpdate(fb._id, { lastReminderSentAt: now });
      console.log(`[DeadlineReminder] Đã nhắc hồ sơ #${shortCode} → ${officer.fullName}`);
    }

    if (feedbacks.length > 0) {
      console.log(`[DeadlineReminder] Đã gửi ${feedbacks.length} nhắc nhở deadline`);
    }
  } catch (err) {
    console.error('[DeadlineReminder] Lỗi:', err.message);
  }
}

function startDeadlineReminder() {
  setTimeout(() => {
    runDeadlineReminders();
    setInterval(runDeadlineReminders, CHECK_INTERVAL_MS);
  }, 5 * 60 * 1000);

  console.log('[DeadlineReminder] Dịch vụ nhắc lịch đã khởi động (kiểm tra mỗi 1 giờ)');
}

module.exports = { startDeadlineReminder };
