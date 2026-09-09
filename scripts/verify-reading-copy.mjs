import { chromium } from 'playwright-core';
import path from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const origin = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, executablePath: chrome });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
const page = await context.newPage();
await page.goto(`${origin}/r/3334298d/index.html`, { waitUntil: 'networkidle' });

const copyButton = page.locator('#copyFullBtn');
if (!(await copyButton.isVisible())) throw new Error('Copy-full button is not visible.');
const box = await copyButton.boundingBox();
if (!box || box.x < 0 || box.x + box.width > 390 || box.y + box.height > 844) {
  throw new Error(`Copy-full button is outside the mobile viewport: ${JSON.stringify(box)}`);
}

await copyButton.click();
const copied = await page.evaluate(() => navigator.clipboard.readText());
if (
  copied.length < 25000 ||
  !copied.startsWith('一份完整的命盘结构研究') ||
  !copied.includes('感官桃花享乐的代偿与身体肉体机能的慢性透支实体化')
) {
  throw new Error(`Copied report text is incomplete: ${copied.length} characters.`);
}
if ((await page.locator('#toast').textContent()) !== '全文已复制') {
  throw new Error('Copy confirmation toast was not shown.');
}

const screenshot = path.resolve('tmp/report-copy-mobile.png');
await page.screenshot({ path: screenshot, fullPage: false });
await browser.close();
console.log(JSON.stringify({ copiedCharacters: copied.length, button: box, screenshot }, null, 2));
