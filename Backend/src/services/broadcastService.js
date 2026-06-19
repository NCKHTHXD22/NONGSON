const {
  sendZaloText, sendZaloTextToGroup,
  sendZaloImages, sendZaloImagesToGroup,
  sendZaloImageWithLink, sendZaloImageWithLinkToGroup,
  sendZaloFile, sendZaloFileToGroup,
} = require('../utils/zaloApi');
const { addLog } = require('./logService');

const jobs = new Map();

function createJob(total) {
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  jobs.set(jobId, { total, sent: 0, failed: 0, done: false, startedAt: new Date().toISOString() });
  return jobId;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

// attachments = { attachmentIds: [], videoAttachmentId: null, fileAttachmentId: null }
async function sendToUsers(userIds, message, attachments = {}, adminNote, linkUrl, linkTitle) {
  const {
    attachmentIds = [],
    videoAttachmentId = null,
    fileAttachmentId = null,
  } = attachments;

  const jobId = createJob(userIds.length);
  const job = jobs.get(jobId);

  (async () => {
    for (const id of userIds) {
      try {
        const isGroup = id.startsWith('g:');
        const actualId = isGroup ? id.slice(2) : id;

        let textToSend = message || '';
        if (linkUrl) {
          const linkLine = linkTitle ? `🔗 ${linkTitle}: ${linkUrl}` : `🔗 ${linkUrl}`;
          textToSend = textToSend ? `${textToSend}\n\n${linkLine}` : linkLine;
        }

        if (textToSend) {
          isGroup
            ? await sendZaloTextToGroup(actualId, textToSend)
            : await sendZaloText(actualId, textToSend);
        }

        if (attachmentIds.length > 0) {
          isGroup
            ? await sendZaloImagesToGroup(actualId, attachmentIds)
            : await sendZaloImages(actualId, attachmentIds);
        }

        // Video: gửi ảnh thumbnail + nút link, hoặc text link
        if (videoAttachmentId) {
          if (videoAttachmentId.startsWith('VIDLINK:')) {
            // Format mới: VIDLINK:thumbnailAttachmentId:videoUrl
            const rest = videoAttachmentId.slice(8);
            const sep = rest.indexOf(':');
            const thumbId = rest.slice(0, sep);
            const videoUrl = rest.slice(sep + 1);
            try {
              isGroup
                ? await sendZaloImageWithLinkToGroup(actualId, thumbId, videoUrl, '▶ Xem video')
                : await sendZaloImageWithLink(actualId, thumbId, videoUrl, '▶ Xem video');
            } catch (e) {
              console.warn('[Broadcast] Image+link thất bại, fallback text:', e.message);
              const msg = `📹 Xem video: ${videoUrl}`;
              isGroup ? await sendZaloTextToGroup(actualId, msg) : await sendZaloText(actualId, msg);
            }
          } else if (videoAttachmentId.startsWith('http')) {
            // URL trực tiếp (không có thumbnail)
            const msg = `📹 Xem video: ${videoAttachmentId}`;
            isGroup ? await sendZaloTextToGroup(actualId, msg) : await sendZaloText(actualId, msg);
          } else {
            // Format cũ: Zalo article token
            const msg = `📹 Xem video: https://zalo.me/oa/article/post?token=${videoAttachmentId}`;
            isGroup ? await sendZaloTextToGroup(actualId, msg) : await sendZaloText(actualId, msg);
          }
        }

        if (fileAttachmentId) {
          isGroup
            ? await sendZaloFileToGroup(actualId, fileAttachmentId)
            : await sendZaloFile(actualId, fileAttachmentId);
        }

        job.sent++;
      } catch (err) {
        console.error('[Broadcast] Lỗi gửi đến', id, ':', err.message);
        job.failed++;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    job.done = true;

    let logMsg = message || '';
    if (!logMsg) {
      if (videoAttachmentId) logMsg = '[video]';
      else if (fileAttachmentId) logMsg = '[file]';
      else if (attachmentIds.length > 0) logMsg = `[${attachmentIds.length} ảnh]`;
      else if (linkUrl) logMsg = `[link] ${linkUrl}`;
    }

    await addLog({
      message: logMsg,
      recipientCount: userIds.length,
      sent: job.sent,
      failed: job.failed,
      adminNote: adminNote || '',
    });
    setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
  })();

  return jobId;
}

module.exports = { sendToUsers, getJob };
