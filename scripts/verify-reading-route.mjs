import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const routeId = process.argv[2];
if (!/^[a-f0-9]{8}$/i.test(routeId ?? '')) {
  throw new Error('Usage: node scripts/verify-reading-route.mjs <8-char-route-id>');
}

const htmlPath = path.resolve(`public/r/${routeId}/index.html`);
const html = await readFile(htmlPath, 'utf8');
const reportMatch = html.match(/const REPORT = (.*?);\r?\n\s*const STORAGE_KEY/s);
assert(reportMatch, 'Embedded report data is missing.');
const report = JSON.parse(reportMatch[1]);
assert(report.chapters.length >= 12 && report.chapters.length <= 16, 'Expected 12 to 16 reader chapters.');
assert(!/\b(?:Q0|CP-[A-D]-M|CASE-|E\d+=|FACT编号|证据登记台账)\b/.test(html), 'Internal workflow content leaked into reader HTML.');
assert(/noindex,nofollow/.test(html), 'Reader page must remain noindex.');

const server = createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.chapter').count(), report.chapters.length);
  assert.equal(await page.locator('.topic').count(), report.chapters.flatMap(chapter => chapter.sections).length);
  assert(await page.locator('#copyFullBtn').isVisible(), 'Copy button is not visible.');
  await page.locator('#copyFullBtn').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert(copied.length > 30000, 'Copied report is unexpectedly short.');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width > 500 ? 1000 : 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}px.`);
    const copyBox = await page.locator('#copyFullBtn').boundingBox();
    assert(copyBox && copyBox.x >= 0 && copyBox.x + copyBox.width <= width, `Copy button outside ${width}px viewport.`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({
    routeId,
    chapters: report.chapters.length,
    topics: report.chapters.flatMap(chapter => chapter.sections).length,
    copiedCharacters: copied.length,
    testedWidths: [320, 390, 1440],
    pageErrors: errors,
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
