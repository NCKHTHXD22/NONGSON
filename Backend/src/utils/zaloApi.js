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

async function sendZaloLinkButton(userId, title, subtitle, buttonLabel, url) {
  try {
    const res = await zaloPost('https://openapi.zalo.me/v2.0/oa/message', {
      recipient: { user_id: String(userId) },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'list',
            elements: [{ title, subtitle, default_action: { type: 'oa.open.url', url } }],
            buttons: [{ title: buttonLabel, type: 'oa.open.url', payload: { url } }],
          },
        },
      },
    });
    if (res.data?.error !== 0) {
      await sendZaloText(userId, `${title}\n${subtitle}\n👉 ${url}`);
    }
  } catch (err) {
    console.error('[Zalo] sendZaloLinkButton thất bại:', err.message);
    await sendZaloText(userId, `${title}\n${subtitle}\n👉 ${url}`);
  }
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

// Lấy danh sách nhóm OA đang quản lý (GMF v3.0)
async function getGroupsOfOA() {
  const doRequest = (token) =>
    axios.get('https://openapi.zalo.me/v3.0/oa/group/getgroupsofoa', {
      headers: { access_token: token },
    });
  let res = await doRequest(getToken());
  if (res.data?.error === -216) {
    const newToken = await refreshAccessToken();
    res = await doRequest(newToken);
  }
  return res.data;
}

// Lấy danh sách thành viên 1 nhóm (GMF v3.0)
async function getGroupMembersV3(groupId) {
  const doRequest = (token) =>
    axios.get('https://openapi.zalo.me/v3.0/oa/group/listmember', {
      params: { group_id: String(groupId), offset: 0, count: 50 },
      headers: { access_token: token },
    });
  let res = await doRequest(getToken());
  if (res.data?.error === -216) {
    const newToken = await refreshAccessToken();
    res = await doRequest(newToken);
  }
  if (res.data?.error !== 0) {
    console.warn(`[Zalo] listmember group=${groupId} lỗi:`, res.data?.error, res.data?.message);
  }
  return { members: res.data?.data?.members || [], raw: res.data };
}

// Tạo nhóm Zalo GMF v3.0 từ danh sách thành viên ban đầu
async function createZaloGroup(name, memberIds, description = '') {
  const assetId = process.env.ZALO_ASSET_ID;
  if (!assetId) throw new Error('Chưa cấu hình ZALO_ASSET_ID trong hệ thống (file .env)');

  const doRequest = (token) =>
    axios.post('https://openapi.zalo.me/v3.0/oa/group/creategroupwithoa', {
      group_name: String(name),
      group_description: String(description || name),
      asset_id: String(assetId),
      member_user_ids: memberIds.map(String),
    }, {
      headers: { access_token: token, 'Content-Type': 'application/json' },
    });

  let res = await doRequest(getToken());
  if (res.data?.error === -216) {
    const newToken = await refreshAccessToken();
    res = await doRequest(newToken);
  }
  if (res.data?.error !== 0) {
    console.error(`[Zalo] Lỗi tạo nhóm "${name}":`, res.data?.error, res.data?.message);
    throw new Error(`Zalo error ${res.data?.error}: ${res.data?.message}`);
  }
  return res.data?.data?.group_id;
}

// Xóa/Giải tán nhóm Zalo GMF v3.0
async function deleteZaloGroup(groupId) {
  const doRequest = (token) =>
    axios.post('https://openapi.zalo.me/v3.0/oa/group/delete', {
      group_id: String(groupId),
    }, {
      headers: { access_token: token, 'Content-Type': 'application/json' },
    });

  let res = await doRequest(getToken());
  if (res.data?.error === -216) {
    const newToken = await refreshAccessToken();
    res = await doRequest(newToken);
  }
  if (res.data?.error !== 0) {
    console.warn(`[Zalo] Lỗi xóa nhóm ${groupId}:`, res.data?.error, res.data?.message);
    throw new Error(`Zalo error ${res.data?.error}: ${res.data?.message}`);
  }
  return true;
}

// Lấy danh sách thành viên đang chờ duyệt vào nhóm (GMF v3.0)
async function getPendingGroupMembers(groupId, offset = 0, count = 50) {
  const doRequest = (token) =>
    axios.get('https://openapi.zalo.me/v3.0/oa/group/listpendinginvite', {
      params: { group_id: String(groupId), offset, count },
      headers: { access_token: token },
    });
  let res = await doRequest(getToken());
  if (res.data?.error === -216) {
    const newToken = await refreshAccessToken();
    res = await doRequest(newToken);
  }
  if (res.data?.error !== 0) {
    console.warn(`[Zalo] listpendinginvite group=${groupId} lỗi:`, res.data?.error, res.data?.message);
  }
  const d = res.data?.data || {};
  return { members: d.members || [], total: d.total || 0, raw: res.data };
}

// Duyệt thành viên đang chờ vào nhóm (GMF v3.0)
async function acceptGroupJoinRequest(groupId, memberUserIds) {
  const doRequest = (token) =>
    axios.post('https://openapi.zalo.me/v3.0/oa/group/acceptpendinginvite', {
      group_id: String(groupId),
      member_user_ids: memberUserIds.map(String),
    }, {
      headers: { access_token: token, 'Content-Type': 'application/json' },
    });

  let res = await doRequest(getToken());
  if (res.data?.error === -216) {
    const newToken = await refreshAccessToken();
    res = await doRequest(newToken);
  }
  if (res.data?.error !== 0) {
    throw new Error(`Zalo error ${res.data?.error}: ${res.data?.message}`);
  }
  return true;
}

// Từ chối thành viên đang chờ vào nhóm (GMF v3.0)
async function rejectGroupJoinRequest(groupId, memberUserIds) {
  const doRequest = (token) =>
    axios.post('https://openapi.zalo.me/v3.0/oa/group/rejectpendinginvite', {
      group_id: String(groupId),
      member_user_ids: memberUserIds.map(String),
    }, {
      headers: { access_token: token, 'Content-Type': 'application/json' },
    });

  let res = await doRequest(getToken());
  if (res.data?.error === -216) {
    const newToken = await refreshAccessToken();
    res = await doRequest(newToken);
  }
  if (res.data?.error !== 0) {
    throw new Error(`Zalo error ${res.data?.error}: ${res.data?.message}`);
  }
  return true;
}

module.exports = {
  sendZaloText,
  sendZaloTextToGroup,
  sendZaloButtons,
  sendZaloLinkButton,
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
  getGroupsOfOA,
  getGroupMembersV3,
  createZaloGroup,
  deleteZaloGroup,
  getPendingGroupMembers,
  acceptGroupJoinRequest,
  rejectGroupJoinRequest,
};
