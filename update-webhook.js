require('dotenv').config();
const axios = require('axios');

const ZALO_OA_TOKEN = process.env.ZALO_OA_TOKEN;
const ngrokUrl = process.argv[2];

if (!ngrokUrl) {
  console.error('Dung: node update-webhook.js <ngrok-url>');
  process.exit(1);
}

const webhookUrl = `${ngrokUrl}/webhook`;

function printManualInstructions() {
  console.log(`
============================================================
  CAP NHAT WEBHOOK THU CONG (neu API that bai):
============================================================
1. Vao https://developers.zalo.me
2. Chon App Chat System Nong Son -> Webhook
3. Dien vao o Callback URL: ${webhookUrl}
4. Bam "Thay doi"
5. Tich: "User gui tin nhan van ban" + "User follow OA"
============================================================
`);
}

async function updateWebhook() {
  console.log(`\nDang cap nhat Zalo webhook -> ${webhookUrl}`);

  // Zalo OA API de cap nhat webhook callback URL
  try {
    const res = await axios.post(
      'https://openapi.zalo.me/v2.0/oa/webhook',
      { callbackUrl: webhookUrl },
      {
        headers: {
          access_token: ZALO_OA_TOKEN,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log('Ket qua API:', JSON.stringify(res.data));

    if (res.data?.error === 0 || res.data?.errorCode === 0) {
      console.log('\n Webhook da duoc cap nhat thanh cong!');
      console.log(`URL: ${webhookUrl}`);
    } else {
      console.log('\n API tra ve loi. Hay cap nhat thu cong:');
      printManualInstructions();
    }
  } catch (err) {
    console.error('Loi goi API:', err.response?.data || err.message);
    console.log('\nHay cap nhat webhook thu cong:');
    printManualInstructions();
  }
}

updateWebhook();
