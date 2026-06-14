const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');

async function htmlToPng(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 560, height: 800 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const filepath = path.join(os.tmpdir(), `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  } finally {
    await browser.close();
  }
}

module.exports = { htmlToPng };
