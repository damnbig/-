import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const html = readFileSync(new URL('../public/r/58621334/index.html', import.meta.url), 'utf8');
const report = JSON.parse(html.match(/const REPORT = (.*?);\r?\n\s*const STORAGE_KEY/s)[1]);
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.chapter').count(), 14);
  assert.equal(await page.locator('.topic').count(), 46);
  assert((await page.title()).includes('措辞修订审阅版'));
  assert.equal(await page.locator('.edition-link a').getAttribute('href'), '/r/6c2f9d81/');
  await page.locator('#copyFullBtn').click();
  const copied = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n');
  for (const chapter of report.chapters) {
    assert(copied.includes(chapter.title));
    for (const section of chapter.sections) {
      for (const key of ['title', 'answer', 'reasoning', 'synthesis', 'boundary']) {
        if (section[key]) assert(copied.includes(section[key]), `Missing copied field ${section.id}/${key}`);
      }
    }
  }
  mkdirSync(new URL('../tmp/', import.meta.url), { recursive: true });
  for (const width of [390, 320, 1440]) {
    await page.setViewportSize({ width, height: width > 500 ? 1000 : 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`);
    const box = await page.locator('#copyFullBtn').boundingBox();
    assert(box.x >= 0 && box.x + box.width <= width);
    await page.screenshot({ path: fileURLToPath(new URL(`../tmp/review-edition-${width}.png`, import.meta.url)), fullPage: false });
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ chapters: 14, topics: 46, copiedCharacters: copied.length, allFieldsCopied: true, testedWidths: [390, 320, 1440], pageErrors: errors }));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
