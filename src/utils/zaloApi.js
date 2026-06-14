const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getToken, refreshAccessToken } = require('./zaloToken');
const CONFIG = require('../config');

async function zaloPost(url, data) {
  const doRequest = (token) =>
    axios.post(url, data, {
      headers: { access_token: token, 'Content-Type': 'application/json' },
    });

  let res = await doRequest(getToken());

  if (res.data?.error === -216) {
    console.warn('[ZaloToken] Token hết hạn, đang refresh...');
    const newToken = await refreshAccessToken();
    res = await doRequest(newToken);
  }

  return res;
}

async function sendZaloText(userId, text) {
  const res = await zaloPost(
    'https://openapi.zalo.me/v2.0/oa/message',
    { recipient: { user_id: String(userId) }, message: { text } }
  );
  if (res.data?.error !== 0) {
    console.error('[Zalo] Lỗi gửi tin:', res.data);
    throw new Error(`Zalo error ${res.data?.error}: ${res.data?.message}`);
  }
}

async function uploadImageBufferToZalo(buffer, filename) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', buffer, { filename: filename || 'image.jpg', contentType: 'image/jpeg' });

  const doUpload = (token) =>
    axios.post('https://openapi.zalo.me/v2.0/oa/upload/image', form, {
      headers: { ...form.getHeaders(), access_token: token },
    });

  let res = await doUpload(getToken());

  if (res.data?.error === -216) {
    const newToken = await refreshAccessToken();
    res = await doUpload(newToken);
  }

  if (res.data?.error !== 0) throw new Error(`Upload ảnh thất bại: ${res.data?.message}`);
  const attachmentId = res.data?.data?.attachment_id;
  if (!attachmentId) throw new Error('Không lấy được attachment_id từ Zalo');
  return attachmentId;
}

// Upload image from local file path (used by broadcast upload endpoint)
async function uploadImageToZalo(filepath) {
  const buffer = fs.readFileSync(filepath);
  const filename = path.basename(filepath);
  return uploadImageBufferToZalo(buffer, filename);
}

// Upload file (docx/pdf/xlsx) to Zalo, returns file token
async function uploadFileToZalo(filepath, originalFilename) {
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(filepath), { filename: originalFilename });

  const doUpload = (token) =>
    axios.post('https://openapi.zalo.me/v2.0/oa/upload/file', form, {
      headers: { ...form.getHeaders(), access_token: token },
    });

  let res = await doUpload(getToken());
  if (res.data?.error === -216) {
    const newToken = await refreshAccessToken();
    res = await doUpload(newToken);
  }
  if (res.data?.error !== 0) throw new Error(`Upload file thất bại: ${res.data?.message}`);
  const token = res.data?.data?.token;
  if (!token) throw new Error('Không lấy được file token từ Zalo');
  return token;
}

async function sendZaloButtons(userId, text, buttons) {
  const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
  const btnLabels = buttons.map((b, i) => `${numbers[i]} ${b.title}`).join('\n');
  await sendZaloText(userId, `${text}\n\n${btnLabels}`);
}

// Gửi text vào nhóm Zalo (theo groupId)
async function sendZaloToGroup(text, groupId, mentions = []) {
  const targetId = groupId || CONFIG.ZALO_GROUP_ID;
  if (!targetId) {
    console.warn('[Zalo] Không có groupId, bỏ qua gửi nhóm.');
    return;
  }
  const message = mentions.length > 0 ? { text, mentions } : { text };
  const res = await zaloPost(
    'https://openapi.zalo.me/v2.0/oa/message',
    { recipient: { group_id: String(targetId) }, message }
  );
  if (res.data?.error !== 0) {
    console.error('[Zalo] Lỗi gửi tin nhóm:', res.data);
    throw new Error(`Zalo group error ${res.data?.error}: ${res.data?.message}`);
  }
}

// Alias cho broadcastService (signature khác: groupId trước, text sau)
async function sendZaloTextToGroup(groupId, text) {
  return sendZaloToGroup(text, groupId);
}

// Tương thích ngược — gửi vào nhóm mặc định
async function sendZaloGroupText(text) {
  return sendZaloToGroup(text, CONFIG.ZALO_GROUP_ID);
}

// Gửi nhiều ảnh đến user (mỗi ảnh 1 message)
async function sendZaloImages(userId, attachmentIds) {
  for (const attachId of attachmentIds) {
    try {
      await zaloPost('https://openapi.zalo.me/v2.0/oa/message', {
        recipient: { user_id: String(userId) },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'media',
              elements: [{ media_type: 'image', attachment_id: attachId }],
            },
          },
        },
      });
    } catch (err) {
      console.error('[Zalo] Gửi ảnh thất bại:', err.message);
    }
  }
}

// Gửi nhiều ảnh vào nhóm
async function sendZaloImagesToGroup(groupId, attachmentIds) {
  for (const attachId of attachmentIds) {
    try {
      await zaloPost('https://openapi.zalo.me/v2.0/oa/message', {
        recipient: { group_id: String(groupId) },
        message: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'media',
              elements: [{ media_type: 'image', attachment_id: attachId }],
            },
          },
        },
      });
    } catch (err) {
      console.error('[Zalo] Gửi ảnh nhóm thất bại:', err.message);
    }
  }
}

// Gửi ảnh kèm nút link (dùng cho video preview)
async function sendZaloImageWithLink(userId, attachmentId, url, buttonTitle = '▶ Xem') {
  try {
    await zaloPost('https://openapi.zalo.me/v2.0/oa/message', {
      recipient: { user_id: String(userId) },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'media',
            elements: [{
              media_type: 'image',
              attachment_id: attachmentId,
              buttons: [{ title: buttonTitle, type: 'oa.open.url', payload: { url } }],
            }],
          },
        },
      },
    });
  } catch (err) {
    console.error('[Zalo] Gửi image+link thất bại:', err.message);
    throw err;
  }
}

// Gửi ảnh kèm nút link vào nhóm
async function sendZaloImageWithLinkToGroup(groupId, attachmentId, url, buttonTitle = '▶ Xem') {
  try {
    await zaloPost('https://openapi.zalo.me/v2.0/oa/message', {
      recipient: { group_id: String(groupId) },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'media',
            elements: [{
              media_type: 'image',
              attachment_id: attachmentId,
              buttons: [{ title: buttonTitle, type: 'oa.open.url', payload: { url } }],
            }],
          },
        },
      },
    });
  } catch (err) {
    console.error('[Zalo] Gửi image+link nhóm thất bại:', err.message);
    throw err;
  }
}

// Gửi file đến user
async function sendZaloFile(userId, fileToken) {
  const res = await zaloPost('https://openapi.zalo.me/v2.0/oa/message', {
    recipient: { user_id: String(userId) },
    message: { attachment: { type: 'file', payload: { token: fileToken } } },
  });
  if (res.data?.error !== 0) {
    console.error('[Zalo] Lỗi gửi file:', res.data);
    throw new Error(`Zalo file error ${res.data?.error}: ${res.data?.message}`);
  }
}

// Gửi file vào nhóm
async function sendZaloFileToGroup(groupId, fileToken) {
  const res = await zaloPost('https://openapi.zalo.me/v2.0/oa/message', {
    recipient: { group_id: String(groupId) },
    message: { attachment: { type: 'file', payload: { token: fileToken } } },
  });
  if (res.data?.error !== 0) {
    console.error('[Zalo] Lỗi gửi file nhóm:', res.data);
    throw new Error(`Zalo file group error ${res.data?.error}: ${res.data?.message}`);
  }
}

async function getZaloUserProfile(userId) {
  try {
    const token = getToken();
    const res = await axios.get(
      `https://openapi.zalo.me/v2.0/oa/getprofile?data=${encodeURIComponent(JSON.stringify({ user_id: String(userId) }))}`,
      { headers: { access_token: token } }
    );
    console.log(`[Zalo] getprofile userId=${userId} → error=${res.data?.error} name="${res.data?.data?.display_name}" raw=${JSON.stringify(res.data)}`);
    if (res.data?.error === 0) return res.data.data;
    return null;
  } catch (err) {
    console.error('[Zalo] Lấy profile thất bại:', err.message);
    return null;
  }
}

async function getZaloGroupMembers(groupId) {
  try {
    const token = getToken();
    const params = JSON.stringify({ group_id: String(groupId), offset: 0, count: 50 });
    const res = await axios.get(
      `https://openapi.zalo.me/v2.0/oa/groupchat/getmember?data=${encodeURIComponent(params)}`,
      { headers: { access_token: token } }
    );

    console.log('[Zalo] getGroupMembers raw response:', JSON.stringify(res.data));

    if (res.data?.error !== 0) {
      console.error('[Zalo] getGroupMembers lỗi API:', res.data?.error, res.data?.message);
      return { members: [], raw: res.data };
    }

    const d = res.data.data;
    const members = Array.isArray(d) ? d
      : Array.isArray(d?.members) ? d.members
      : [];

    console.log(`[Zalo] getGroupMembers groupId=${groupId} => ${members.length} thành viên`);
    return { members, raw: res.data };
  } catch (err) {
    console.error('[Zalo] getGroupMembers thất bại:', err.message);
    return { members: [], raw: { error: -1, message: err.message } };
  }
}

module.exports = {
  sendZaloText,
  sendZaloTextToGroup,
  sendZaloButtons,
  sendZaloToGroup,
  sendZaloGroupText,
  sendZaloImages,
  sendZaloImagesToGroup,
  sendZaloImageWithLink,
  sendZaloImageWithLinkToGroup,
  sendZaloFile,
  sendZaloFileToGroup,
  getZaloUserProfile,
  uploadImageBufferToZalo,
  uploadImageToZalo,
  uploadFileToZalo,
  getZaloGroupMembers,
};
