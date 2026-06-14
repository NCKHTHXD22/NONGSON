const cloudinary = require('cloudinary').v2;
const axios = require('axios');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload từ URL công khai (http/https)
async function uploadFromUrl(imageUrl) {
  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: 'nongson-goopy',
    resource_type: 'image',
  });
  return result.secure_url;
}

// Upload từ Buffer (ảnh Zalo gửi về, cần download trước)
async function uploadFromBuffer(buffer, filename) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'nongson-goopy', resource_type: 'image', public_id: filename },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// Download ảnh từ Zalo rồi upload lên Cloudinary
async function uploadFromZaloImageUrl(zaloUrl) {
  const res = await axios.get(zaloUrl, { responseType: 'arraybuffer', timeout: 15000 });
  const buffer = Buffer.from(res.data);
  const filename = `zalo-${Date.now()}`;
  return uploadFromBuffer(buffer, filename);
}

module.exports = { uploadFromUrl, uploadFromBuffer, uploadFromZaloImageUrl };
